const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

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
        if (interaction.user.id !== match.sideSelector) return interaction.reply({ content: 'Sıra sizde değil!', flags: MessageFlags.Ephemeral });

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

        // --- VERİTABANI DÜZELTME (Yeni: eloService kullanarak) ---
        try {
            const allPlayers = [...match.teamA, ...match.teamB];
            for (const pid of allPlayers) {
                const user = await User.findOne({ odasi: pid, odaId: channel.guild.id });
                if (user) {
                    eloService.ensureValidStats(user);
                    await user.save();
                }
            }
        } catch (e) { console.error("[ELO Service] Validation Error:", e); }
        // ---------------------------------------------------------

        // --- SES KANALLARINI OLUŞTUR VE OYUNCULARI TAŞI ---
        try {
            const guild = channel.guild;
            // 1. Kategori Bul (Match Channel'ın parent'ı)
            const parentCategory = channel.parent;

            // Kaptan isimlerini al
            const captainAMember = await guild.members.fetch(match.captainA).catch(() => null);
            const captainBMember = await guild.members.fetch(match.captainB).catch(() => null);
            const captainAName = captainAMember?.displayName?.substring(0, 15) || 'Team A';
            const captainBName = captainBMember?.displayName?.substring(0, 15) || 'Team B';

            // Taraf kısaltmaları
            const sideA = match.teamASide === 'ATTACK' ? 'ATK' : 'DEF';
            const sideB = match.teamBSide === 'ATTACK' ? 'ATK' : 'DEF';

            if (parentCategory) {
                // Team A Kanalı
                const channelA = await guild.channels.create({
                    name: `🔷 Team ${captainAName} (${sideA})`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory.id,
                    userLimit: 5,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel],
                            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages]
                        },
                        ...match.teamA.map(id => ({
                            id,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD]
                        }))
                    ]
                });

                // Team B Kanalı
                const channelB = await guild.channels.create({
                    name: `🟥 Team ${captainBName} (${sideB})`,
                    type: ChannelType.GuildVoice,
                    parent: parentCategory.id,
                    userLimit: 5,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel],
                            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages]
                        },
                        ...match.teamB.map(id => ({
                            id,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD]
                        }))
                    ]
                });

                // Kanalları Kaydet (Silmek İçin)
                match.createdChannelIds.push(channelA.id);
                match.createdChannelIds.push(channelB.id);
                await match.save();

                // 2. Oyuncuları Taşı (Memory-safe: tek tek fetch)
                // Team A Taşı
                for (const id of match.teamA) {
                    const member = await guild.members.fetch(id).catch(() => null);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(channelA).catch(e => console.log(`Move error A: ${e.message}`));
                    }
                }

                // Team B Taşı
                for (const id of match.teamB) {
                    const member = await guild.members.fetch(id).catch(() => null);
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
        let mapName = match.selectedMap || 'Unknown';
        // Dosya yolu: src/handlers/match/game.js -> ../../../assets/maps/MapName.png

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

        // --- ÖNCEKİ MESAJLARI TEMİZLE (Draft, Voting, Side Selection vb.) ---
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const botMessages = messages.filter(m => m.author.id === channel.client.user.id);
            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages).catch(() => { });
            }
        } catch (e) {
            console.log('[Cleanup] Previous messages cleanup error:', e.message);
        }
        // ---------------------------------------------------------------------

        const captainA = await channel.guild.members.fetch(match.captainA).catch(() => ({ displayName: 'PLAYER A' }));
        const captainB = await channel.guild.members.fetch(match.captainB).catch(() => ({ displayName: 'PLAYER B' }));

        const nameA = `TEAM ${captainA.displayName.toUpperCase()}`;
        const nameB = `TEAM ${captainB.displayName.toUpperCase()}`;

        const divider = '<a:ayrma:1468003499072688309>'.repeat(5);

        // Level emojileriyle oyuncu listesi oluştur
        const buildPlayerList = async (playerIds) => {
            const lines = [];
            for (const id of playerIds) {
                const userDoc = await User.findOne({ odasi: id, odaId: channel.guild.id });
                const level = userDoc?.matchStats?.matchLevel || 1;
                const levelEmoji = eloService.getLevelEmoji(level);
                lines.push(`${levelEmoji} <@${id}>`);
            }
            return lines.length > 0 ? lines.join('\n') : 'Oyuncu yok';
        };

        const listA = `${divider}\n${await buildPlayerList(match.teamA)}`;
        const listB = `${divider}\n${await buildPlayerList(match.teamB)}`;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C) // Live Red
            .setTitle(`🔴 MAÇ BAŞLADI! (LIVE)`)
            .setDescription(`## 🗺️ Harita: **${match.selectedMap.toUpperCase()}** ${divider}`)
            .addFields(
                { name: '🎮 VALORANT Lobi Kodu', value: `\`\`\`${match.lobbyCode || 'BEKLENİYOR'}\`\`\``, inline: false },
                { name: `🔹 ${nameA} (${match.teamASide === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND'})`, value: listA, inline: true },
                { name: `🔸 ${nameB} (${match.teamBSide === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND'})`, value: listB, inline: true }
            )
            .setFooter({ text: 'Maç devam ediyor... İyi şanslar! • Made by Swaff' })
            .setTimestamp();

        if (mapAttachment) {
            embed.setImage(`attachment://${mapImageName}`);
        } else {
            // Fallback
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

    async handleScoreSubmit(interaction, matchParam) {
        // Match parametresi verilmediyse customId'den al
        let match = matchParam;
        if (!match) {
            const matchId = interaction.customId.split('_')[2];
            match = await Match.findOne({ matchId });
            if (!match) {
                return interaction.reply({ content: '❌ Maç bulunamadı!', flags: MessageFlags.Ephemeral });
            }
        }

        const sA = parseInt(interaction.fields.getTextInputValue('scoreA'));
        const sB = parseInt(interaction.fields.getTextInputValue('scoreB'));

        if (isNaN(sA) || isNaN(sB)) {
            return interaction.reply({ content: 'Lütfen geçerli sayılar girin!', flags: MessageFlags.Ephemeral });
        }

        match.scoreA = sA;
        match.scoreB = sB;

        // Kazananı Belirle
        if (sA > sB) match.winner = 'A';
        else if (sB > sA) match.winner = 'B';
        else match.winner = 'DRAW'; // Berabere ise yine de MVP seçilebilir

        await match.save();

        await this.openWinnerMVPMenu(interaction, match);
    },

    async openWinnerMVPMenu(interaction, match) {
        // Kazanan Takım (Berabere ise Team A başlasın veya hepsi)
        let targetTeamIds = [];
        if (match.winner === 'A') targetTeamIds = match.teamA;
        else if (match.winner === 'B') targetTeamIds = match.teamB;
        else targetTeamIds = [...match.teamA, ...match.teamB]; // Draw ise hepsi

        // Seçenekleri Hazırla (Level emojileriyle)
        const options = [];
        for (const id of targetTeamIds) {
            let username = 'Unknown Player';
            let levelEmoji = eloService.LEVEL_EMOJIS[1];
            try {
                const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id);
                if (member) username = member.user.username;
                const userDoc = await User.findOne({ odasi: id, odaId: interaction.guild.id });
                const level = userDoc?.matchStats?.matchLevel || 1;
                levelEmoji = eloService.LEVEL_EMOJIS[level] || eloService.LEVEL_EMOJIS[1];
            } catch (e) { }

            options.push({
                label: username,
                value: id,
                description: 'Kazanan Takım Oyuncusu',
                emoji: levelEmoji.match(/:([0-9]+)>/)?.[1] // Emoji ID'sini çıkar
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`match_mvp_winner_${match.matchId}`)
            .setPlaceholder('KAZANAN Takımın MVP\'sini Seçin')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `📊 **Maç Skoru:** ${match.scoreA} - ${match.scoreB}\n🏆 **Kazanan Takım:** ${match.winner === 'DRAW' ? 'BERABERE' : (match.winner === 'A' ? 'Blue Team' : 'Red Team')}\n\nLütfen **KAZANAN** takımın MVP oyuncusunu seçin.`,
            components: [row],
            ephemeral: false
        });
    },

    async handleWinnerMVP(interaction, match) {
        const selectedMVPId = interaction.values[0];
        match.mvpPlayerId = selectedMVPId; // Winner MVP
        await match.save();

        // Şimdi Kaybeden Takım MVP
        await interaction.update({ content: `✅ Kazanan MVP Seçildi: <@${selectedMVPId}>\nŞimdi **KAYBEDEN** takımın MVP'sini seçin...`, components: [] });
        await this.openLoserMVPMenu(interaction, match);
    },

    async openLoserMVPMenu(interaction, match) {
        // Kaybeden Takım
        let targetTeamIds = [];
        if (match.winner === 'A') targetTeamIds = match.teamB; // A kazandıysa B kaybetti
        else if (match.winner === 'B') targetTeamIds = match.teamA;
        else return this.finishMatch(interaction, match); // Berabere ise 2. MVP yok, bitir.

        // Eğer kaybeden takım boşsa direkt bitir
        if (!targetTeamIds || targetTeamIds.length === 0) {
            return this.finishMatch(interaction, match);
        }

        const options = [];
        for (const id of targetTeamIds) {
            let username = 'Unknown Player';
            let levelEmojiId = null;
            try {
                const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id);
                if (member) username = member.user.username;
                const userDoc = await User.findOne({ odasi: id, odaId: interaction.guild.id });
                const level = userDoc?.matchStats?.matchLevel || 1;
                const levelEmoji = eloService.LEVEL_EMOJIS[level] || eloService.LEVEL_EMOJIS[1];
                levelEmojiId = levelEmoji.match(/:([0-9]+)>/)?.[1];
            } catch (e) { }

            options.push({
                label: username,
                value: id,
                description: 'Kaybeden Takım Oyuncusu',
                emoji: levelEmojiId
            });
        }

        // Options boşsa (hata durumu) direkt bitir
        if (options.length === 0) {
            console.warn('[MVP] Loser team options empty, finishing match directly.');
            return this.finishMatch(interaction, match);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`match_mvp_loser_${match.matchId}`)
            .setPlaceholder('KAYBEDEN Takımın MVP\'sini Seçin')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Yeni mesaj göndermek yerine (veya editlemek):
        // handleWinnerMVP içinde update kullanmıştık. Buradan yeni bir followUp veya channel.send yapabiliriz.
        // Veya interaction.channel.send

        await interaction.channel.send({
            content: `💔 **Kaybeden Takımın MVP\'sini Seçin.**`,
            components: [row]
        });
    },

    async handleLoserMVP(interaction, match) {
        const selectedLoserMVPId = interaction.values[0];
        match.mvpLoserId = selectedLoserMVPId;

        match.status = 'FINISHED';
        match.endTime = new Date();
        await match.save();

        await interaction.update({ content: `✅ Kaybeden MVP Seçildi: <@${selectedLoserMVPId}>\nSkorlar işleniyor ve ELO hesaplanıyor...`, components: [] });
        await this.finishMatch(interaction, match);
    },

    async finishMatch(interaction, match) {
        const scoreA = match.scoreA;
        const scoreB = match.scoreB;
        const roundDiff = Math.abs(scoreA - scoreB);
        // Maksimum +10 round bonusu
        const roundBonus = Math.min(roundDiff, eloService.ELO_CONFIG.MAX_ROUND_BONUS);

        let winnerTeam = 'DRAW';
        if (scoreA > scoreB) winnerTeam = 'A';
        if (scoreB > scoreA) winnerTeam = 'B';

        match.winner = winnerTeam;
        await match.save();

        // ELO Hesaplama (eloService kullanarak)
        const allPlayerIds = [...match.teamA, ...match.teamB];

        // 1. Tüm Kullanıcıları Çek
        const allUserDocs = await User.find({ odasi: { $in: allPlayerIds }, odaId: interaction.guild.id });
        const userMap = new Map();
        allUserDocs.forEach(u => userMap.set(u.odasi, u));

        // Eksik user varsa oluştur (eloService.createDefaultStats ile)
        for (const pid of allPlayerIds) {
            if (!userMap.has(pid)) {
                const newUser = new User({
                    odasi: pid,
                    odaId: interaction.guild.id,
                    matchStats: eloService.createDefaultStats()
                });
                await newUser.save();
                userMap.set(pid, newUser);
            }
        }

        // 2. Takım Ortalamalarını Hesapla
        let totalEloA = 0;
        let totalEloB = 0;

        match.teamA.forEach(pid => {
            const user = userMap.get(pid);
            eloService.ensureValidStats(user);
            totalEloA += user.matchStats.elo;
        });
        match.teamB.forEach(pid => {
            const user = userMap.get(pid);
            eloService.ensureValidStats(user);
            totalEloB += user.matchStats.elo;
        });

        const avgEloA = Math.round(totalEloA / match.teamA.length);
        const avgEloB = Math.round(totalEloB / match.teamB.length);

        console.log(`[ELO] Match #${match.matchNumber} | Team A Avg: ${avgEloA} vs Team B Avg: ${avgEloB}`);

        // 3. Puan Dağıtımı
        for (const pid of allPlayerIds) {
            try {
                const user = userMap.get(pid);
                eloService.ensureValidStats(user);

                user.matchStats.totalMatches++;

                const isTeamA = match.teamA.includes(pid);
                const myTeamAvg = isTeamA ? avgEloA : avgEloB;
                const enemyTeamAvg = isTeamA ? avgEloB : avgEloA;

                if (winnerTeam !== 'DRAW') {
                    const isWin = (winnerTeam === 'A' && isTeamA) || (winnerTeam === 'B' && !isTeamA);

                    if (isWin) {
                        user.matchStats.totalWins++;
                    } else {
                        user.matchStats.totalLosses++;
                    }

                    // ELO değişikliğini hesapla
                    const eloChange = eloService.calculateMatchEloChange({
                        isWin,
                        roundDiff,
                        myTeamAvg,
                        enemyTeamAvg,
                        isMvpWinner: match.mvpPlayerId === pid,
                        isMvpLoser: match.mvpLoserId === pid
                    });

                    // ELO'yu uygula (Audit log ile)
                    const reason = isWin ? `Win vs Avg:${enemyTeamAvg}` : `Loss vs Avg:${enemyTeamAvg}`;
                    await eloService.applyEloChange(user, eloChange, `Match #${match.matchNumber} | ${reason}`);
                } else {
                    // Beraberlik - sadece save
                    await user.save();
                }

            } catch (e) { console.error("[ELO Service] Process Error:", e); }
        }

        // --- SES KANALI TEMİZLİĞİ VE TAŞIMA ---
        try {
            const guild = interaction.guild;

            // 1. Önce herkesi lobiye taşı (Memory-safe: tek tek fetch)
            if (match.lobbyVoiceId) {
                for (const pid of allPlayerIds) {
                    const member = await guild.members.fetch(pid).catch(() => null);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                    }
                }
            }

            // 2. Kısa bekle (oyuncuların taşınması için)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Ses kanallarının boş olduğunu kontrol et ve sil
            if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                for (const cid of match.createdChannelIds) {
                    const ch = guild.channels.cache.get(cid) || await guild.channels.fetch(cid).catch(() => null);
                    if (ch) {
                        // Eğer hala birileri varsa 2 saniye daha bekle
                        if (ch.members && ch.members.size > 0) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        await ch.delete().catch(() => { });
                    }
                }
            }
        } catch (e) {
            console.error("Voice cleanup error:", e);
        }
        // ----------------------------------------

        // --- LOGLAMA (Maç Sonucu Log Kanalına) ---
        try {
            const logsChannelId = '1468002079632134369';
            const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

            if (logsChannel) {
                const winnerTeamName = winnerTeam === 'A' ? 'Team A' : 'Team B';
                const mvpWinnerMention = match.mvpPlayerId ? `<@${match.mvpPlayerId}>` : 'Seçilmedi';
                const mvpLoserMention = match.mvpLoserId ? `<@${match.mvpLoserId}>` : 'Seçilmedi';

                // Lobi Bilgisi (ID'den bulmaya çalış)
                const { LOBBY_CONFIG } = require('./constants');
                const lobbyInfo = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
                const lobbyName = lobbyInfo ? lobbyInfo.name : 'Unknown Lobby';

                // Süre
                const durationMs = new Date() - match.createdAt;
                const durationMinutes = Math.floor(durationMs / 60000);

                const logEmbed = new EmbedBuilder()
                    .setColor(0x2B2D31)
                    .setAuthor({ name: `Maç Sonucu • #${match.matchNumber || match.matchId}`, iconURL: interaction.guild.iconURL() })
                    .setDescription(`**Skor:** ${match.scoreA} - ${match.scoreB}\n**Kazanan:** ${winnerTeam === 'DRAW' ? 'BERABERE' : winnerTeamName}`)
                    .addFields(
                        { name: '📍 Lobi', value: lobbyName, inline: true },
                        { name: '🗺️ Harita', value: match.selectedMap || '?', inline: true },
                        { name: '⏱️ Süre', value: `${durationMinutes} dk`, inline: true },
                        { name: '⭐ Kazanan MVP', value: mvpWinnerMention, inline: true },
                        { name: '💔 Kaybeden MVP', value: mvpLoserMention, inline: true },
                        { name: '📊 Ortalamalar', value: `A: ${avgEloA} | B: ${avgEloB}`, inline: true },
                        { name: `🔵 Team A (${match.scoreA})`, value: match.teamA.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false },
                        { name: `🔴 Team B (${match.scoreB})`, value: match.teamB.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false }
                    )
                    .setFooter({ text: `Match ID: ${match.matchId}` })
                    .setTimestamp();

                await logsChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error('Match Finish Log Error:', logErr);
        }
        // -------------------------------------------

        match.status = 'FINISHED';
        await match.save();

        // Özet Mesajı ve Kanal Silme
        if (interaction.channel) {
            const winnerTeamName = winnerTeam === 'A' ? 'Team A' : 'Team B';
            const mvpWinnerMention = match.mvpPlayerId ? `<@${match.mvpPlayerId}>` : 'Seçilmedi';
            const mvpLoserMention = match.mvpLoserId ? `<@${match.mvpLoserId}>` : 'Seçilmedi';

            const summaryEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ Maç Tamamlandı!')
                .setDescription(`**Skor:** ${match.scoreA} - ${match.scoreB}`)
                .addFields(
                    { name: '🏆 Kazanan', value: winnerTeam === 'DRAW' ? 'Berabere' : winnerTeamName, inline: true },
                    { name: '📊 Team Ortalamaları', value: `A: ${avgEloA} | B: ${avgEloB}`, inline: true },
                    { name: '⭐ Kazanan MVP', value: mvpWinnerMention, inline: true },
                    { name: '💔 Kaybeden MVP', value: mvpLoserMention, inline: true }
                )
                .setFooter({ text: 'Kanal 5 saniye sonra silinecek...' })
                .setTimestamp();

            await interaction.channel.send({ embeds: [summaryEmbed] });

            // Text kanalını en son sil
            setTimeout(() => {
                interaction.channel.delete().catch(() => { });
            }, 5000);
        }
    }
};
