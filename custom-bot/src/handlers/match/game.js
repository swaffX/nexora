const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const manager = require('./manager');

module.exports = {
    async handleCoinFlip(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (interaction.user.id !== match.captainA) {
            return interaction.reply({ content: 'Sadece Kaptan A yazı tura atabilir!', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const outcome = Math.random() < 0.5 ? 'YAZI' : 'TURA';
        const winnerId = outcome === 'YAZI' ? match.captainA : match.captainB;
        const loserId = winnerId === match.captainA ? match.captainB : match.captainA;

        match.pickTurn = winnerId === match.captainA ? 'A' : 'B';
        match.status = 'SIDE_SELECTION';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🪙 YAZI TURA SONUCU')
            .setDescription(`Sonuç: **${outcome}**\nKazanan: <@${winnerId}>\n\n**<@${winnerId}>** lütfen tarafını seç!`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_sidepick_attack_${matchId}`).setLabel('Saldırı (Attack)').setStyle(ButtonStyle.Danger).setEmoji('🗡️'),
            new ButtonBuilder().setCustomId(`match_sidepick_defend_${matchId}`).setLabel('Savunma (Defend)').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
        );

        await interaction.update({ embeds: [embed], components: [row] });
    },

    async handleSidePick(interaction) {
        const parts = interaction.customId.split('_');
        const side = parts[2]; // attack / defend
        const matchId = parts[3];
        const match = await Match.findOne({ matchId });

        const currentCap = match.pickTurn === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== currentCap) return interaction.reply({ content: 'Sıra sende değil!', flags: require('discord.js').MessageFlags.Ephemeral });

        // Taraf seçimini kaydet (Basitçe logluyoruz, oyun içi manuel geçecekler)
        const teamSide = match.pickTurn === 'A' ? `Team A: ${side.toUpperCase()}` : `Team B: ${side.toUpperCase()}`;

        match.status = 'LIVE';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔴 MAÇ BAŞLIYOR!')
            .setDescription(`**Harita:** ${match.selectedMap}\n**Seçim:** <@${currentCap}> **${side.toUpperCase()}** tarafını seçti.\n\nHerkes Lobiye! İyi eğlenceler!`)
            .addFields(
                { name: 'Valorant Lobi Kodu', value: `\`${match.lobbyCode || 'Bekleniyor...'}\``, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_endmatch_${matchId}`).setLabel('🔴 Maçı Bitir').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [row] });

        // Ses kanallarına taşıma işlemi (manager)
        try {
            await manager.movePlayersToTeamChannels(interaction.guild, match);
        } catch (e) { console.error(e); }
    },

    async endMatch(interaction) {
        if (!interaction.isMessageComponent()) return;

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (match.status === 'FINISHING' || match.status === 'FINISHED') {
            return interaction.reply({ content: '⚠️ Bu maç zaten sonlandırılıyor.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        match.status = 'FINISHING';
        await match.save();

        await interaction.reply({ content: '🏁 **Maç Sonlandırılıyor...**\nSes kanalları siliniyor.', flags: require('discord.js').MessageFlags.Ephemeral });

        try {
            await manager.forceEndMatch(interaction.guild, matchId, 'Maç Bitir butonu ile sonlandırıldı.');
            await manager.cleanupVoiceChannels(interaction.guild, match);
        } catch (e) { }

        // 3. MVP SEÇİMİ (Önce MVP'yi soruyoruz)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_selectmvp_${matchId}`).setLabel('MVP Seç & Skor Gir').setStyle(ButtonStyle.Success).setEmoji('⭐')
        );

        await interaction.channel.send({
            content: `✅ **Lobi temizlendi.**\n\nLütfen aşağıdaki butona basarak önce **Maçın MVP'sini** seçin, ardından skoru girin.`,
            components: [row]
        });
    },

    async openMVPSelectMenu(interaction) {
        const matchId = interaction.customId.split('_')[2];

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`match_mvp_select_${matchId}`)
            .setPlaceholder('Maçın MVP Oyuncusunu Seçin (Yıldız Oyuncu)')
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: '⭐ **Maçın En Değerli Oyuncusunu (MVP) Seçin:**\n(Kazanan veya Kaybeden takımdan olabilir)',
            components: [row],
            flags: require('discord.js').MessageFlags.Ephemeral
        });
    },

    async handleMVPSelect(interaction) {
        // match_mvp_select_ID
        const matchId = interaction.customId.split('_')[3];
        const match = await Match.findOne({ matchId });

        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });

        const mvpId = interaction.values[0];

        // VALIDATION: Seçilen kişi bu maçta mı?
        const allPlayers = [...match.teamA, ...match.teamB];
        if (!allPlayers.includes(mvpId)) {
            const { MessageFlags } = require('discord.js');
            return interaction.reply({
                content: '⚠️ **Hata:** Seçtiğiniz kişi bu maçta oynamıyor! Lütfen sadece takımlardaki oyunculardan birini MVP seçin.',
                flags: MessageFlags.Ephemeral
            });
        }

        match.mvpPlayerId = mvpId;
        await match.save();

        // Modal Aç
        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${matchId}`)
            .setTitle('Maç Skoru Gir');

        const scoreA = new TextInputBuilder().setCustomId('score_a').setLabel('Team A Skoru').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);
        const scoreB = new TextInputBuilder().setCustomId('score_b').setLabel('Team B Skoru').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(scoreA), new ActionRowBuilder().addComponents(scoreB));

        await interaction.showModal(modal);
    },

    // TAŞ KAĞIT MAKAS BAŞLATIC (Side Pick İçin)
    async prepareMatchStart(channel, match) {
        match.status = 'RPS_GAME'; // Rock Paper Scissors
        match.rpsMoveA = null;
        match.rpsMoveB = null;
        await match.save();

        const { EmbedBuilder } = require('discord.js');
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

    async handleRPSMove(interaction) {
        const parts = interaction.customId.split('_');
        const move = parts[2]; // ROCK, PAPER, SCISSORS
        const matchId = parts[3];
        const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const match = await Match.findOne({ matchId });
        if (!match) return;

        let isCaptainA = interaction.user.id === match.captainA;
        let isCaptainB = interaction.user.id === match.captainB;

        if (!isCaptainA && !isCaptainB) {
            return interaction.reply({ content: 'Sadece kaptanlar oynayabilir!', flags: MessageFlags.Ephemeral });
        }

        if (isCaptainA) match.rpsMoveA = move;
        if (isCaptainB) match.rpsMoveB = move;
        await match.save();

        await interaction.reply({ content: `✅ Hamleniz kaydedildi: **${move}** (Rakip görmüyor)`, flags: MessageFlags.Ephemeral });

        // İkisi de seçti mi?
        if (match.rpsMoveA && match.rpsMoveB) {
            const moveA = match.rpsMoveA;
            const moveB = match.rpsMoveB;
            let winnerId = null;
            let resultText = '';

            // Beraberlik
            if (moveA === moveB) {
                match.rpsMoveA = null;
                match.rpsMoveB = null;
                await match.save();
                return interaction.channel.send(`⚖️ **BERABERE!** İki kaptan da **${moveA}** seçti. Tekrar oynayın!`);
            }

            // Kurallar: Taş(Rock) > Makas(Scissors) > Kağıt(Paper) > Taş
            if (
                (moveA === 'ROCK' && moveB === 'SCISSORS') ||
                (moveA === 'SCISSORS' && moveB === 'PAPER') ||
                (moveA === 'PAPER' && moveB === 'ROCK')
            ) {
                winnerId = match.captainA; // A Kazandı
            } else {
                winnerId = match.captainB; // B Kazandı (Aksi durumlar)
            }

            match.pickTurn = winnerId === match.captainA ? 'A' : 'B';
            match.status = 'SIDE_SELECTION';
            await match.save();

            const winEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🏆 KAZANAN BELİRLENDİ!')
                .setDescription(`🔵 **Team A:** ${moveA}\n🔴 **Team B:** ${moveB}\n\n**Kazanan:** <@${winnerId}>\n\nŞimdi taraf seçme sırası sende!`)
                .setFooter({ text: 'Kazanan tarafı seçer!' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_sidepick_attacker_${match.matchId}`).setLabel('Saldırı (Attack)').setStyle(ButtonStyle.Danger).setEmoji('🗡️'),
                new ButtonBuilder().setCustomId(`match_sidepick_defender_${match.matchId}`).setLabel('Savunma (Defend)').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
            );

            await interaction.channel.send({ embeds: [winEmbed], components: [row] });
        }
    },

    // Legacy backup
    async showScoreModal(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${matchId}`)
            .setTitle('Maç Skoru Gir');
        const scoreA = new TextInputBuilder().setCustomId('score_a').setLabel('Team A Skoru').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);
        const scoreB = new TextInputBuilder().setCustomId('score_b').setLabel('Team B Skoru').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(scoreA), new ActionRowBuilder().addComponents(scoreB));
        await interaction.showModal(modal);
    },

    async handleScoreSubmit(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });

        const scoreA = interaction.fields.getTextInputValue('score_a');
        const scoreB = interaction.fields.getTextInputValue('score_b');

        match.scoreA = scoreA;
        match.scoreB = scoreB;
        await match.save();

        await interaction.reply({
            content: `✅ **Skor ve MVP Kaydedildi.**\nMaç sonlandırılıyor ve puanlar hesaplanıyor...`,
            flags: require('discord.js').MessageFlags.Ephemeral
        });

        // Direkt bitir (SS bekleme yok)
        await this.finishMatch(interaction, match);
    },

    async finishMatch(interaction, match) {
        const { EmbedBuilder } = require('discord.js');
        const manager = require('./manager');

        match.status = 'FINISHED';
        if (!match.playedMaps.includes(match.selectedMap)) match.playedMaps.push(match.selectedMap);

        // --- MAÇ SONUCU ANALİZİ ---
        const scoreA = parseInt(match.scoreA);
        const scoreB = parseInt(match.scoreB);
        let winnerTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : 'DRAW');
        match.winnerTeam = winnerTeam;
        await match.save();

        const roundDiff = Math.abs(scoreA - scoreB);
        const roundBonus = Math.round(roundDiff * 0.8); // Raund Farkı Etkisi (Daha dengeli: 13-0 ise +10 Puan)

        // --- LEVEL TABLOSU ---
        const getLevelData = (elo) => {
            if (elo <= 800) return 1; if (elo <= 950) return 2; if (elo <= 1100) return 3;
            if (elo <= 1250) return 4; if (elo <= 1400) return 5; if (elo <= 1550) return 6;
            if (elo <= 1700) return 7; if (elo <= 1850) return 8; if (elo <= 2000) return 9; return 10;
        };

        const allPlayerIds = [...match.teamA, ...match.teamB];

        // 1. Tüm Kullanıcıları Çek
        const allUserDocs = await User.find({ odasi: { $in: allPlayerIds }, odaId: interaction.guild.id });
        const userMap = new Map();
        allUserDocs.forEach(u => userMap.set(u.odasi, u));

        // Eksik user varsa oluştur
        for (const pid of allPlayerIds) {
            if (!userMap.has(pid)) {
                const newUser = new User({ odasi: pid, odaId: interaction.guild.id, matchStats: { elo: 1000, matchLevel: 3 } });
                await newUser.save();
                userMap.set(pid, newUser);
            }
        }

        // 2. Takım Ortalamalarını Hesapla
        let totalEloA = 0;
        let totalEloB = 0;

        match.teamA.forEach(pid => totalEloA += (userMap.get(pid).matchStats.elo || 1000));
        match.teamB.forEach(pid => totalEloB += (userMap.get(pid).matchStats.elo || 1000));

        const avgEloA = Math.round(totalEloA / match.teamA.length);
        const avgEloB = Math.round(totalEloB / match.teamB.length);

        console.log(`ELO Calculation: Team A Avg: ${avgEloA} vs Team B Avg: ${avgEloB}`);

        // 3. Puan Dağıtımı
        for (const pid of allPlayerIds) {
            try {
                const user = userMap.get(pid);
                if (!user.matchStats || !user.matchStats.elo) {
                    user.matchStats = { totalMatches: 0, totalWins: 0, totalLosses: 0, elo: 1000, matchLevel: 3 };
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

                        if (match.mvpPlayerId === pid) finalEloChange += 10;
                    } else {
                        user.matchStats.totalLosses++;
                        // Kaybetme: Baz + Adalet
                        // (Kaybeden skor farkından dolayı ekstra ceza almaz, sadece rakip çok zayıfsa adalet puanından dolayı fazla kaybeder)
                        let lossAmount = BASE_LOSS + fairnessAdjustment;

                        // MVP Koruması
                        if (match.mvpPlayerId === pid) lossAmount += 15;

                        // Limit: Kayıp asla 0'dan büyük olamaz (Pozitif olamaz)
                        if (lossAmount > 0) lossAmount = 0;

                        finalEloChange = lossAmount;
                    }
                }

                user.matchStats.elo += finalEloChange;
                if (user.matchStats.elo < 0) user.matchStats.elo = 0;
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
