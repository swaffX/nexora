const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {

    async prepareMatchStart(channel, match) {
        match.status = 'RPS_GAME'; // Rock Paper Scissors
        match.rpsMoveA = null;
        match.rpsMoveB = null;
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('✂️ TAŞ - KAĞIT - MAKAS')
            .setDescription(`**Harita:** ${match.selectedMap}\n\nTakım taraflarını (Saldırı/Savunma) belirlemek için kaptanlar kapışıyor!\n\n🔵 **Team A:** <@${match.captainA}>\n🔴 **Team B:** <@${match.captainB}>\n\n**Hamlenizi yapın! (Gizli Seçim)**`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/439/439498.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_rps_ROCK_${match.matchId}`).setLabel('TAŞ').setStyle(ButtonStyle.Secondary).setEmoji('🪨'),
            new ButtonBuilder().setCustomId(`match_rps_PAPER_${match.matchId}`).setLabel('KAĞIT').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
            new ButtonBuilder().setCustomId(`match_rps_SCISSORS_${match.matchId}`).setLabel('MAKAS').setStyle(ButtonStyle.Secondary).setEmoji('✂️')
        );

        await channel.send({ content: `<@${match.captainA}> <@${match.captainB}>`, embeds: [embed], components: [row] });
    },

    async handleRPSMove(interaction, match, move) {
        const userId = interaction.user.id;

        if (userId === match.captainA) {
            if (match.rpsMoveA) return interaction.reply({ content: 'Zaten seçim yaptınız!', ephemeral: true });
            match.rpsMoveA = move;
        } else if (userId === match.captainB) {
            if (match.rpsMoveB) return interaction.reply({ content: 'Zaten seçim yaptınız!', ephemeral: true });
            match.rpsMoveB = move;
        } else {
            return interaction.reply({ content: 'Sadece kaptanlar oynayabilir!', ephemeral: true });
        }

        await match.save();

        if (match.rpsMoveA && match.rpsMoveB) {
            await interaction.deferUpdate();
            await this.resolveRPSGame(interaction.channel, match);
        } else {
            await interaction.reply({ content: `Seçiminiz kaydedildi (${move}). Rakibi bekliyoruz...`, ephemeral: true });
        }
    },

    async resolveRPSGame(channel, match) {
        const moveA = match.rpsMoveA;
        const moveB = match.rpsMoveB;
        let winner = null; // 'A' or 'B' or null (draw)

        if (moveA === moveB) {
            winner = null;
        } else if (
            (moveA === 'ROCK' && moveB === 'SCISSORS') ||
            (moveA === 'PAPER' && moveB === 'ROCK') ||
            (moveA === 'SCISSORS' && moveB === 'PAPER')
        ) {
            winner = 'A';
        } else {
            winner = 'B';
        }

        const moveEmoji = { 'ROCK': '🪨', 'PAPER': '📄', 'SCISSORS': '✂️' };

        if (winner) {
            // Kazanan Side Seçer
            match.status = 'SIDE_SELECTION';
            match.sideSelector = winner === 'A' ? match.captainA : match.captainB;
            await match.save();

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🏆 Kazanan Belirlendi!')
                .setDescription(`**Team A:** ${moveEmoji[moveA]}\n**Team B:** ${moveEmoji[moveB]}\n\n🎉 **Kazanan:** <@${match.sideSelector}>\n\nŞimdi taraf seçme sırası onda!`)

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_side_ATTACK_${match.matchId}`).setLabel('SALDIRI (Attack)').setStyle(ButtonStyle.Danger).setEmoji('🗡️'),
                new ButtonBuilder().setCustomId(`match_side_DEFEND_${match.matchId}`).setLabel('SAVUNMA (Defend)').setStyle(ButtonStyle.Success).setEmoji('🛡️')
            );

            await channel.send({ content: `<@${match.sideSelector}>`, embeds: [embed], components: [row] });

        } else {
            // Berabere - Tekrar
            match.rpsMoveA = null;
            match.rpsMoveB = null;
            await match.save();

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🤝 Beraberlik!')
                .setDescription(`**Team A:** ${moveEmoji[moveA]}\n**Team B:** ${moveEmoji[moveB]}\n\nTekrar oynanıyor...`);

            await channel.send({ embeds: [embed] });

            // Yeni butonları at
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_rps_ROCK_${match.matchId}`).setLabel('TAŞ').setStyle(ButtonStyle.Secondary).setEmoji('🪨'),
                new ButtonBuilder().setCustomId(`match_rps_PAPER_${match.matchId}`).setLabel('KAĞIT').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
                new ButtonBuilder().setCustomId(`match_rps_SCISSORS_${match.matchId}`).setLabel('MAKAS').setStyle(ButtonStyle.Secondary).setEmoji('✂️')
            );
            await channel.send({ content: `<@${match.captainA}> <@${match.captainB}>`, components: [row] });
        }
    },

    async handleSideSelection(interaction, match, side) {
        if (interaction.user.id !== match.sideSelector) return interaction.reply({ content: 'Sıra sizde değil!', ephemeral: true });

        const selectorTeam = match.sideSelector === match.captainA ? 'A' : 'B';
        match.teamASide = selectorTeam === 'A' ? side : (side === 'ATTACK' ? 'DEFEND' : 'ATTACK');
        match.teamBSide = selectorTeam === 'B' ? side : (side === 'ATTACK' ? 'DEFEND' : 'ATTACK');
        match.status = 'PLAYING';
        match.startTime = new Date();
        await match.save();

        await interaction.update({ components: [] });
        await this.startMatch(interaction.channel, match);
    },

    async startMatch(channel, match) {
        const teamAString = match.teamA.map(id => `<@${id}>`).join(', ');
        const teamBString = match.teamB.map(id => `<@${id}>`).join(', ');

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🔥 MAÇ BAŞLADI!') // Başlık basitleştirildi
            .setDescription(`**Harita:** ${match.selectedMap}\n\n**🔵 Team A (${match.teamASide === 'ATTACK' ? 'Saldırı' : 'Savunma'}):**\n${teamAString}\n\n**🔴 Team B (${match.teamBSide === 'ATTACK' ? 'Saldırı' : 'Savunma'}):**\n${teamBString}\n\nMaç sonucunu bildirmek için aşağıdaki butonları kullanın.`)
            .setImage('https://media1.tenor.com/m/xR0y16wVbQcAAAAC/valorant-clutch.gif')
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_score_${match.matchId}`)
                    .setLabel('Skor Gir')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId(`match_cancel_${match.matchId}`)
                    .setLabel('İptal Et')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({ content: `@here Maç Başladı!`, embeds: [embed], components: [row] });
    },

    async openScoreModal(interaction, match) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${match.matchId}`)
            .setTitle('Maç Sonucu');

        const scoreAInput = new TextInputBuilder()
            .setCustomId('scoreA')
            .setLabel("Team A Skoru")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('13')
            .setRequired(true);

        const scoreBInput = new TextInputBuilder()
            .setCustomId('scoreB')
            .setLabel("Team B Skoru")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('5')
            .setRequired(true);

        const firstRow = new ActionRowBuilder().addComponents(scoreAInput);
        const secondRow = new ActionRowBuilder().addComponents(scoreBInput);

        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
    },

    async handleScoreSubmit(interaction, match) {
        const sA = parseInt(interaction.fields.getTextInputValue('scoreA'));
        const sB = parseInt(interaction.fields.getTextInputValue('scoreB'));

        if (isNaN(sA) || isNaN(sB)) {
            return interaction.reply({ content: 'Lütfen geçerli sayılar girin!', ephemeral: true });
        }

        match.scoreA = sA;
        match.scoreB = sB;
        await match.save();

        await this.openMVPSelectMenu(interaction, match);
    },

    async openMVPSelectMenu(interaction, match) {
        // Maçı yapan userları bul
        const allPlayerIds = [...match.teamA, ...match.teamB];

        // Interaction'dan userları çekmek yerine veritabanı ID'lerini kullanacağız.
        // Ancak SelectMenu için Username lazım.
        const options = [];

        for (const id of allPlayerIds) {
            let username = 'Unknown Player';
            try {
                // Cache'den veya fetch'ten al
                const user = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id);
                if (user) username = user.user.username;
            } catch (e) { }

            options.push({
                label: username,
                value: id,
                description: match.teamA.includes(id) ? 'Team A' : 'Team B'
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`match_mvp_select_${match.matchId}`)
            .setPlaceholder('Maçın MVP\'sini Seçin')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `📊 **Maç Skoru:** ${match.scoreA} - ${match.scoreB}\nLütfen maçın **MVP** oyuncusunu seçin.`,
            components: [row],
            ephemeral: false // Herkes görsün
        });
    },

    async handleMVPSelect(interaction, match) {
        // DÜZELTME: Değişken ismindeki boşluk silindi
        const selectedMVPId = interaction.values[0];
        match.mvpPlayerId = selectedMVPId;
        match.status = 'FINISHED';
        match.endTime = new Date();
        await match.save();

        // DÜZELTME: Değişken ismi düzeltildi
        await interaction.update({ content: `✅ MVP Seçildi: <@${selectedMVPId}>\nSkorlar işleniyor ve ELO hesaplanıyor...`, components: [] });
        await this.finishMatch(interaction, match);
    },

    async finishMatch(interaction, match) {
        const scoreA = match.scoreA;
        const scoreB = match.scoreB;
        const roundDiff = Math.abs(scoreA - scoreB);
        // Maksimum +10 round bonusu
        const roundBonus = Math.min(roundDiff, 10);

        let winnerTeam = 'DRAW';
        if (scoreA > scoreB) winnerTeam = 'A';
        if (scoreB > scoreA) winnerTeam = 'B';

        match.winner = winnerTeam;
        await match.save();

        // ELO - Level Hesaplama (YENİ SİSTEM: 100-500 Level 1)
        const getLevelData = (elo) => {
            if (elo <= 500) return 1; if (elo <= 750) return 2; if (elo <= 900) return 3;
            if (elo <= 1050) return 4; if (elo <= 1200) return 5; if (elo <= 1350) return 6;
            if (elo <= 1530) return 7; if (elo <= 1750) return 8; if (elo <= 2000) return 9; return 10;
        };

        const allPlayerIds = [...match.teamA, ...match.teamB];

        // 1. Tüm Kullanıcıları Çek
        const allUserDocs = await User.find({ odasi: { $in: allPlayerIds }, odaId: interaction.guild.id });
        const userMap = new Map();
        allUserDocs.forEach(u => userMap.set(u.odasi, u));

        // Eksik user varsa oluştur
        for (const pid of allPlayerIds) {
            if (!userMap.has(pid)) {
                // VARSAYILAN ELO: 100, LEVEL: 1
                const newUser = new User({ odasi: pid, odaId: interaction.guild.id, matchStats: { elo: 100, matchLevel: 1 } });
                await newUser.save();
                userMap.set(pid, newUser);
            }
        }

        // 2. Takım Ortalamalarını Hesapla
        let totalEloA = 0;
        let totalEloB = 0;

        match.teamA.forEach(pid => totalEloA += (userMap.get(pid).matchStats.elo || 100));
        match.teamB.forEach(pid => totalEloB += (userMap.get(pid).matchStats.elo || 100));

        const avgEloA = Math.round(totalEloA / match.teamA.length);
        const avgEloB = Math.round(totalEloB / match.teamB.length);

        console.log(`ELO Calculation: Team A Avg: ${avgEloA} vs Team B Avg: ${avgEloB}`);

        // 3. Puan Dağıtımı
        for (const pid of allPlayerIds) {
            try {
                const user = userMap.get(pid);
                if (!user.matchStats || !user.matchStats.elo) {
                    user.matchStats = { totalMatches: 0, totalWins: 0, totalLosses: 0, elo: 100, matchLevel: 1 };
                }

                user.matchStats.totalMatches++;

                const isTeamA = match.teamA.includes(pid);
                const myTeamAvg = isTeamA ? avgEloA : avgEloB;
                const enemyTeamAvg = isTeamA ? avgEloB : avgEloA;

                // ADALET FAKTÖRÜ (Dengeli)
                // Her 40 ELO farkı ±1 Puan. Max ±10.
                let eloDiff = enemyTeamAvg - myTeamAvg;
                let fairnessAdjustment = Math.round(eloDiff / 40);

                if (fairnessAdjustment > 10) fairnessAdjustment = 10;
                if (fairnessAdjustment < -10) fairnessAdjustment = -10;

                const BASE_WIN = 20;
                const BASE_LOSS = -20;
                let finalEloChange = 0;

                if (winnerTeam !== 'DRAW') {
                    const isWin = (winnerTeam === 'A' && isTeamA) || (winnerTeam === 'B' && !isTeamA);

                    if (isWin) {
                        user.matchStats.totalWins++;
                        // Kazanma: Baz + Raund Bonusu + Adalet + MVP
                        finalEloChange = BASE_WIN + roundBonus + fairnessAdjustment;

                        if (match.mvpPlayerId === pid) finalEloChange += 5; // MVP Bonusu: +5 (Düşürüldü)
                    } else {
                        user.matchStats.totalLosses++;
                        // Kaybetme: Baz + Adalet
                        let lossAmount = BASE_LOSS + fairnessAdjustment;

                        // MVP Koruması (AZALTILDI: +15 yerine +5)
                        // Örn: -20 + 5 = -15 Kayıp
                        if (match.mvpPlayerId === pid) lossAmount += 5;

                        // Limit: Kayıp asla 0'dan büyük olamaz (Pozitif olamaz)
                        if (lossAmount > 0) lossAmount = 0;

                        finalEloChange = lossAmount;
                    }
                }

                user.matchStats.elo += finalEloChange;

                // ALT SINIR: 100 ELO (BUNUN ALTINA DÜŞMEZ)
                if (user.matchStats.elo < 100) user.matchStats.elo = 100;

                user.matchStats.matchLevel = getLevelData(user.matchStats.elo);

                await user.save();

            } catch (e) { console.error("ELO Process Error:", e); }
        }

        // Kanalı Sil
        if (interaction.channel) {
            interaction.channel.send(`✅ **Maç Bitti! Puanlar Hesaplandı (Balanced System).**\n📊 **Ortalamalar:** Team A (${avgEloA}) vs Team B (${avgEloB})\nKanal siliniyor...`);
            setTimeout(() => {
                interaction.channel.delete().catch(() => { });
            }, 4000);
        }
    }
};
