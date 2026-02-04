const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {

    async prepareMatchStart(channel, match) {
        // RPS İPTAL EDİLDİ - DİREKT TARAF SEÇİMİ
        // Draft başında belirlenen sideSelector'a göre işlem yapıyoruz.

        if (!match.sideSelector) {
            // Eğer sideSelector belirlenmemişse (eski maç vs.) Team A seçsin
            match.sideSelector = match.captainA;
            await match.save();
        }

        match.status = 'SIDE_SELECTION';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🛡️ TARAF SEÇİMİ')
            .setDescription(`**Harita:** ${match.selectedMap}\n\n**Team A:** <@${match.captainA}>\n**Team B:** <@${match.captainB}>\n\n**Seçim Sırası:** <@${match.sideSelector}>\nTarafınızı seçin!`)

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_side_ATTACK_${match.matchId}`).setLabel('SALDIRI (Attack)').setStyle(ButtonStyle.Danger).setEmoji('🗡️'),
            new ButtonBuilder().setCustomId(`match_side_DEFEND_${match.matchId}`).setLabel('SAVUNMA (Defend)').setStyle(ButtonStyle.Success).setEmoji('🛡️')
        );

        await channel.send({ content: `<@${match.sideSelector}>`, embeds: [embed], components: [row] });
    },

    // handleRPSMove ve resolveRPSGame SİLİNDİ

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

        // --- SES KANALLARINI OLUŞTUR VE OYUNCULARI TAŞI ---
        try {
            const guild = channel.guild;
            // 1. Kategori Bul (Match Channel'ın parent'ı)
            const parentCategory = channel.parent;

            if (parentCategory) {
                // Team A Kanalı
                const channelA = await guild.channels.create({
                    name: `🔷 Team A`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory.id,
                    userLimit: 5,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        ...match.teamA.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }))
                    ]
                });

                // Team B Kanalı
                const channelB = await guild.channels.create({
                    name: `🟥 Team B`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory.id,
                    userLimit: 5,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        ...match.teamB.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }))
                    ]
                });

                // Kanalları Kaydet (Silmek İçin)
                match.createdChannelIds.push(channelA.id);
                match.createdChannelIds.push(channelB.id);
                await match.save();

                // 2. Oyuncuları Taşı
                const allMembers = await guild.members.fetch();

                // Team A Taşı
                for (const id of match.teamA) {
                    const member = allMembers.get(id);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(channelA).catch(e => console.log(`Move error A: ${e.message}`));
                    }
                }

                // Team B Taşı
                for (const id of match.teamB) {
                    const member = allMembers.get(id);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(channelB).catch(e => console.log(`Move error B: ${e.message}`));
                    }
                }
            }
        } catch (e) {
            console.error("Voice Channel Error:", e);
            channel.send("⚠️ Ses kanalları oluşturulurken veya taşınırken bir hata oluştu.");
        }
        // -----------------------------------------------------

        // --- HARİTA GÖRSELİ (LOCAL ASSETS) ---
        const { AttachmentBuilder } = require('discord.js');
        const fs = require('fs');
        const path = require('path');

        let mapName = match.selectedMap || 'Unknown';
        // Dosya yolu: src/handlers/match/game.js -> ../../../assets/maps/MapName.png
        // Ancak map isimleri "Bind", "Ascent" gibi. Dosya uzantısı .png varsayıyoruz.

        // assets klasörünü doğru bulmak için path.join kullan
        // game.js -> match -> handlers -> src -> custom-bot -> (bir üstte assets olabilir mi? kontrol edelim)
        // Kullanıcının attığı dosya yapısına göre: c:\Users\zeyne\OneDrive\Masaüstü\nexora\custom-bot\assets\maps

        const assetsPath = path.join(__dirname, '..', '..', '..', 'assets', 'maps');
        const mapFilePath = path.join(assetsPath, `${mapName}.png`);

        let mapAttachment = null;
        let mapImageName = 'default.png';

        // Debug için
        // console.log("Map Path Looking at:", mapFilePath);

        if (fs.existsSync(mapFilePath)) {
            mapAttachment = new AttachmentBuilder(mapFilePath, { name: `${mapName}.png` });
            mapImageName = `${mapName}.png`;
        } else {
            // Belki küçük harfle?
            const lowerPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);
            if (fs.existsSync(lowerPath)) {
                mapAttachment = new AttachmentBuilder(lowerPath, { name: `${mapName}.png` });
                mapImageName = `${mapName}.png`;
            }
        }

        const formatTeamList = (ids) => ids.map(id => `> <@${id}>`).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xFF4654)
            .setTitle(`⚔️ MAÇ BAŞLADI! (#${match.matchNumber})`)
            .setDescription(`Savaş başladı! İyi olan kazansın.\n\n🗺️ **Harita:** \`${match.selectedMap}\``)
            .addFields(
                {
                    name: `🔵 TEAM A (${match.teamASide === 'ATTACK' ? '🗡️ Saldırı' : '🛡️ Savunma'})`,
                    value: formatTeamList(match.teamA),
                    inline: true
                },
                {
                    name: `🔴 TEAM B (${match.teamBSide === 'ATTACK' ? '🗡️ Saldırı' : '🛡️ Savunma'})`,
                    value: formatTeamList(match.teamB),
                    inline: true
                },
                {
                    name: 'Kaptanlar',
                    value: `🔵 <@${match.captainA}> vs 🔴 <@${match.captainB}>`,
                    inline: false
                }
            )
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/12369/12369138.png')
            .setFooter({ text: `Nexora Competitive • Match ID: ${match.matchId} • İyi Oyunlar!` })
            .setTimestamp();

        if (mapAttachment) {
            embed.setImage(`attachment://${mapImageName}`);
        } else {
            // İnternetten bulmaya çalış veya gif koy
            embed.setImage('https://media1.tenor.com/m/xR0y16wVbQcAAAAC/valorant-clutch.gif');
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_score_${match.matchId}`)
                    .setLabel('Skor Bildir')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId(`match_cancel_${match.matchId}`)
                    .setLabel('İptal Et')
                    .setStyle(ButtonStyle.Danger)
            );

        const payload = {
            content: `<@&${match.guildId === '123' ? 'ROLE_ID' : ''}> @here **Maç Başladı!** Ses kanallarına geçiş yapıldı.`,
            embeds: [embed],
            components: [row]
        };

        if (mapAttachment) {
            payload.files = [mapAttachment];
        }

        await channel.send(payload);
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
        const selectedMVPId = interaction.values[0];
        match.mvpPlayerId = selectedMVPId;
        match.status = 'FINISHED';
        match.endTime = new Date();
        await match.save();

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

                        if (match.mvpPlayerId === pid) finalEloChange += 5;
                    } else {
                        user.matchStats.totalLosses++;
                        // Kaybetme: Baz + Adalet
                        let lossAmount = BASE_LOSS + fairnessAdjustment;

                        // MVP Koruması (AZALTILDI: +5)
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

        // --- SES KANALI TEMİZLİĞİ VE TAŞIMA ---
        try {
            const guild = interaction.guild;
            if (match.lobbyVoiceId) {
                // Herkesi ana lobiye taşı
                const allMembers = await guild.members.fetch();
                for (const pid of allPlayerIds) {
                    const member = allMembers.get(pid);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                    }
                }
            }

            // Oluşturulan Kanalları Sil
            if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                for (const cid of match.createdChannelIds) {
                    const ch = guild.channels.cache.get(cid) || await guild.channels.fetch(cid).catch(() => null);
                    if (ch) await ch.delete().catch(() => { });
                }
            }
        } catch (e) {
            console.error("Voice cleanup error:", e);
        }
        // ----------------------------------------

        match.status = 'FINISHED';
        await match.save();

        // Kanalı Sil
        if (interaction.channel) {
            interaction.channel.send(`✅ **Maç Bitti! Puanlar Hesaplandı (Balanced System).**\n📊 **Ortalamalar:** Team A (${avgEloA}) vs Team B (${avgEloB})\nKanal siliniyor...`);
            setTimeout(() => {
                interaction.channel.delete().catch(() => { });
            }, 4000);
        }
    }
};
