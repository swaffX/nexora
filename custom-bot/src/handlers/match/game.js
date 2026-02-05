const path = require('path');
const rankHandler = require('../rankHandler');
const fs = require('fs');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');
const canvasGenerator = require('../../utils/canvasGenerator');

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

        // 1. Kaptan Verilerini Hazırla (Canvas İçin)
        const captainA = await channel.guild.members.fetch(match.captainA).catch(() => null);
        const captainB = await channel.guild.members.fetch(match.captainB).catch(() => null);

        // Mock User objects if fetch fails
        const mockUser = { displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png', username: 'Unknown' };

        const dataA = {
            id: match.captainA,
            name: captainA?.displayName || 'Team A',
            user: captainA?.user || mockUser
        };
        const dataB = {
            id: match.captainB,
            name: captainB?.displayName || 'Team B',
            user: captainB?.user || mockUser
        };

        // 2. Canvas Oluştur
        let attachment = null;
        try {
            // Harita adını match objesinden alıyoruz
            const mapName = match.selectedMap || 'Unknown';
            const buffer = await canvasGenerator.createSideSelectionImage(dataA, dataB, match.sideSelector, mapName);
            attachment = new AttachmentBuilder(buffer, { name: 'side-selection.png' });
        } catch (e) {
            console.error('Side Selection Canvas Error:', e);
        }

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F) // Gold
            .setTitle('🛡️ TARAF SEÇİMİ')
            .setDescription(`**Harita:** ${match.selectedMap}\n\nSeçim Sırası: <@${match.sideSelector}>\nLütfen tarafınızı seçin (Saldırı veya Savunma).`)
            .setImage('attachment://side-selection.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_side_ATTACK_${match.matchId}`).setLabel('SALDIRI (Attack)').setStyle(ButtonStyle.Danger).setEmoji('🗡️'),
            new ButtonBuilder().setCustomId(`match_side_DEFEND_${match.matchId}`).setLabel('SAVUNMA (Defend)').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
        );

        const payload = {
            content: `<@${match.sideSelector}>`,
            embeds: [embed],
            components: [row]
        };

        if (attachment) payload.files = [attachment];

        await channel.send(payload);
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

        // Kaptan Bilgilerini Çek
        const captainA = await channel.guild.members.fetch(match.captainA).catch(() => null);
        const captainB = await channel.guild.members.fetch(match.captainB).catch(() => null);

        // İsimleri Kısalt
        const shortNameA = captainA?.displayName ? captainA.displayName.toUpperCase().substring(0, 12) : 'PLAYER A';
        const shortNameB = captainB?.displayName ? captainB.displayName.toUpperCase().substring(0, 12) : 'PLAYER B';

        const nameA = `TEAM ${shortNameA}`;
        const nameB = `TEAM ${shortNameB}`;

        // --- GÖRSEL HAZIRLIĞI (VERSUS CANVAS) ---
        let mapAttachment = null;
        let mapImageName = 'versus.png';

        try {
            // Stats Çek
            const captainUserDataA = await User.findOne({ odasi: match.captainA, odaId: channel.guild.id });
            const captainUserDataB = await User.findOne({ odasi: match.captainB, odaId: channel.guild.id });

            const statsA = captainUserDataA?.matchStats || { matchLevel: 1, elo: 200 };
            const statsB = captainUserDataB?.matchStats || { matchLevel: 1, elo: 200 };

            // Canvas Oluştur
            if (captainA && captainB) {
                const buffer = await canvasGenerator.createVersusImage(
                    { user: captainA.user, stats: statsA, name: shortNameA },
                    { user: captainB.user, stats: statsB, name: shortNameB },
                    match.selectedMap || 'Unknown'
                );
                mapAttachment = new AttachmentBuilder(buffer, { name: 'versus.png' });
            }
        } catch (e) {
            console.error('Versus Image Gen Error:', e);
            // Hata durumunda eski statik harita görseline fallback yapabiliriz ama şimdilik devam
        }

        // Eğer Versus Canvas başarısız olursa, statik harita görselini dene
        if (!mapAttachment) {
            const assetsPath = path.join(__dirname, '..', '..', '..', 'assets', 'maps');
            const mapName = match.selectedMap || 'Unknown';
            let mapPath = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(mapPath)) mapPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(mapPath)) {
                mapAttachment = new AttachmentBuilder(mapPath, { name: `${mapName}.png` });
                mapImageName = `${mapName}.png`;
            }
        }

        // --- ÖNCEKİ MESAJLARI TEMİZLE ---
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const botMessages = messages.filter(m => m.author.id === channel.client.user.id);
            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages).catch(() => { });
            }
        } catch (e) { }

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

        const sideAIcon = match.teamASide === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND';
        const sideBIcon = match.teamBSide === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND';

        // Taraf bilgisi artik listenin basinda
        const listA = `**${sideAIcon}**\n${divider}\n${await buildPlayerList(match.teamA)}`;
        const listB = `**${sideBIcon}**\n${divider}\n${await buildPlayerList(match.teamB)}`;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C) // Live Red
            .setTitle(`🔴 MAÇ BAŞLADI! (LIVE)`)
            // Harita adından sonra yeni satıra geçildi
            .setDescription(`## 🗺️ Harita: **${match.selectedMap.toUpperCase()}**\n${divider}`)
            .addFields(
                { name: '🎮 VALORANT Lobi Kodu', value: `\`\`\`${match.lobbyCode || 'BEKLENİYOR'}\`\`\``, inline: false },
                { name: `🔹 ${nameA}`, value: listA, inline: true },
                { name: `🔸 ${nameB}`, value: listB, inline: true }
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
                    .setCustomId(`match_prefinish_${match.matchId}`) // Önce temizlik, sonra skor
                    .setLabel('Maçı Bitir')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🏁'),
                new ButtonBuilder()
                    .setCustomId(`match_cancel_${match.matchId}`)
                    .setLabel('İptal')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛑')
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
        // YETKİ KONTROLÜ: Sadece Host
        if (interaction.user.id !== match.hostId) {
            return interaction.reply({ content: '❌ Bu işlemi sadece maçı oluşturan yetkili yapabilir!', flags: MessageFlags.Ephemeral });
        }

        // Temizlik zaten yapıldı, direkt modalı aç
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

    // Yeni Fonksiyon: Temizlik ve Hazırlık
    async preFinishMatch(interaction, match) {
        if (interaction.user.id !== match.hostId) {
            return interaction.reply({ content: '❌ Bu işlemi sadece maçı oluşturan yetkili yapabilir!', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({ content: '🔄 **Oyuncular lobiye taşınıyor ve kanallar temizleniyor... Lütfen bekleyin.**', flags: MessageFlags.Ephemeral });

        // Temizliği Bekle
        await this.cleanupMatchChannels(interaction.guild, match);

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        // Yeni Kontrol Panelini Gönder
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_score_${match.matchId}`).setLabel('Skor ve MVP Gir').setStyle(ButtonStyle.Primary).setEmoji('📝')
        );

        await interaction.editReply({
            content: '✅ **Temizlik Tamamlandı!**\nAşağıdaki butona basarak maç sonucunu girebilirsiniz.',
            components: [row]
        });
    },

    async cleanupMatchChannels(guild, match) {
        if (!guild) return;
        try {
            // 1. Oyuncuları Lobby Voice'a taşı
            if (match.lobbyVoiceId) {
                const allPlayers = [...match.teamA, ...match.teamB];
                await Promise.all(allPlayers.map(async (pid) => {
                    try {
                        const member = guild.members.cache.get(pid) || await guild.members.fetch(pid).catch(() => null);
                        if (member && member.voice.channelId) {
                            await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                        }
                    } catch (e) { }
                }));
            }

            // 2. Ses kanallarını sil
            if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                // Taşınma için kısa bekleme
                await new Promise(r => setTimeout(r, 1000));

                for (const cid of match.createdChannelIds) {
                    // YAZI KANALINI SİLME! Match Channel ID'si created listesinde olabilir
                    if (cid === match.channelId) continue;

                    try {
                        const ch = guild.channels.cache.get(cid) || await guild.channels.fetch(cid).catch(() => null);
                        if (ch) await ch.delete().catch(() => { });
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error("Cleanup error:", e);
        }
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

        // Beraberlik Kontrolü (Beraberlik YOK)
        if (sA === sB) {
            return interaction.reply({ content: '❌ **Beraberlik Olamaz!**\nLütfen uzatmalar dahil **FİNAL** skorunu girin (Örn: 14-12, 16-14).', flags: MessageFlags.Ephemeral });
        }

        // Kazananı Belirle
        // Kazananı Belirle
        if (sA > sB) match.winner = 'A';
        else match.winner = 'B';

        // MVP Reset (Güvenlik Önlemi - İkisi de seçilmeli)
        match.mvpPlayerId = null;
        match.mvpLoserId = null;

        await match.save();

        await this.openMVPMenus(interaction, match);
    },

    async openMVPMenus(interaction, match) {
        // Takımları Belirle
        let winnerTeamIds = [];
        let loserTeamIds = [];

        if (match.winner === 'A') {
            winnerTeamIds = match.teamA;
            loserTeamIds = match.teamB;
        } else {
            winnerTeamIds = match.teamB;
            loserTeamIds = match.teamA;
        }

        // --- KAZANAN TAKIM OPSİYONLARI ---
        const winnerOptions = [];
        for (const id of winnerTeamIds) {
            let username = 'Unknown Player';
            let levelEmojiId = null;
            try {
                const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
                if (member) username = member.user.username;
                const userDoc = await User.findOne({ odasi: id, odaId: interaction.guild.id });
                if (userDoc?.matchStats?.matchLevel) {
                    const emoji = eloService.LEVEL_EMOJIS[userDoc.matchStats.matchLevel] || eloService.LEVEL_EMOJIS[1];
                    levelEmojiId = emoji.match(/:([0-9]+)>/)?.[1];
                }
            } catch (e) { }
            winnerOptions.push({ label: username, value: id, description: 'Kazanan Takım', emoji: levelEmojiId });
        }

        // --- KAYBEDEN TAKIM OPSİYONLARI ---
        const loserOptions = [];
        for (const id of loserTeamIds) {
            let username = 'Unknown Player';
            let levelEmojiId = null;
            try {
                const member = interaction.guild.members.cache.get(id) || await interaction.guild.members.fetch(id).catch(() => null);
                if (member) username = member.user.username;
                const userDoc = await User.findOne({ odasi: id, odaId: interaction.guild.id });
                if (userDoc?.matchStats?.matchLevel) {
                    const emoji = eloService.LEVEL_EMOJIS[userDoc.matchStats.matchLevel] || eloService.LEVEL_EMOJIS[1];
                    levelEmojiId = emoji.match(/:([0-9]+)>/)?.[1];
                }
            } catch (e) { }
            loserOptions.push({ label: username, value: id, description: 'Kaybeden Takım', emoji: levelEmojiId });
        }

        // Menüleri Oluştur
        const rows = [];

        // 1. Kazanan MVP Menüsü
        if (winnerOptions.length > 0) {
            const winnerSelect = new StringSelectMenuBuilder()
                .setCustomId(`match_mvp_winner_${match.matchId}`)
                .setPlaceholder('🏆 KAZANAN Takımın MVP\'sini Seçin')
                .addOptions(winnerOptions);
            rows.push(new ActionRowBuilder().addComponents(winnerSelect));
        }

        // 2. Kaybeden MVP Menüsü
        if (loserOptions.length > 0) {
            const loserSelect = new StringSelectMenuBuilder()
                .setCustomId(`match_mvp_loser_${match.matchId}`)
                .setPlaceholder('💔 KAYBEDEN Takımın MVP\'sini Seçin')
                .addOptions(loserOptions);
            rows.push(new ActionRowBuilder().addComponents(loserSelect));
        } else {
            // Kaybeden takım boşsa (test vs) otomatik bypass gerekebilir ama şimdilik boş bırakalım, finishMatch manuel çağrılmalı veya tek menü.
            // Ama kullanıcı "Kaybeden takımda 1 kişi bile olsa" dediği için sorun yok.
        }

        await interaction.reply({
            content: `📊 **Maç Skoru:** ${match.scoreA} - ${match.scoreB}\n🏆 **Kazanan:** ${match.winner === 'A' ? 'Blue Team' : 'Red Team'}\n\nLütfen **HER İKİ** takımın da MVP oyuncusunu seçin. Maç, ikisi de seçilince bitecektir.`,
            components: rows,
            flags: MessageFlags.Ephemeral // Belki public yapmak istersin? İsteğine göre değiştirebiliriz.
        });
    },

    async handleWinnerMVP(interaction, match) {
        // ROL KONTROLÜ
        const MVP_SELECTOR_ROLE_ID = '1463875325019557920';
        if (!interaction.member.roles.cache.has(MVP_SELECTOR_ROLE_ID)) {
            return interaction.reply({ content: `❌ Yetkiniz yok! (<@&${MVP_SELECTOR_ROLE_ID}> gerekli)`, flags: MessageFlags.Ephemeral });
        }

        const selectedId = interaction.values[0];
        match.mvpPlayerId = selectedId;
        await match.save();

        // Diğeri de seçilmiş mi?
        if (match.mvpLoserId) {
            await interaction.update({ content: `✅ **Kazanan MVP:** <@${selectedId}>\n✅ **Kaybeden MVP:** <@${match.mvpLoserId}>\n\n🔄 **Maç Bitiriliyor...**`, components: [] });
            await this.finishMatch(interaction, match);
        } else {
            await interaction.reply({ content: `✅ **Kazanan MVP Seçildi:** <@${selectedId}>\nLütfen Kaybeden MVP'yi de seçin.`, flags: MessageFlags.Ephemeral });
        }
    },

    async handleLoserMVP(interaction, match) {
        // ROL KONTROLÜ
        const MVP_SELECTOR_ROLE_ID = '1463875325019557920';
        if (!interaction.member.roles.cache.has(MVP_SELECTOR_ROLE_ID)) {
            return interaction.reply({ content: `❌ Yetkiniz yok! (<@&${MVP_SELECTOR_ROLE_ID}> gerekli)`, flags: MessageFlags.Ephemeral });
        }

        const selectedId = interaction.values[0];
        match.mvpLoserId = selectedId;
        await match.save();

        // Diğeri de seçilmiş mi?
        if (match.mvpPlayerId) {
            await interaction.update({ content: `✅ **Kazanan MVP:** <@${match.mvpPlayerId}>\n✅ **Kaybeden MVP:** <@${selectedId}>\n\n🔄 **Maç Bitiriliyor...**`, components: [] });
            await this.finishMatch(interaction, match);
        } else {
            await interaction.reply({ content: `✅ **Kaybeden MVP Seçildi:** <@${selectedId}>\nLütfen Kazanan MVP'yi de seçin.`, flags: MessageFlags.Ephemeral });
        }
    },

    // Eski openLoserMVPMenu artık kullanılmıyor, silebiliriz veya placeholder olarak bırakabiliriz.
    async openLoserMVPMenu(interaction, match) {
        // Deprecated
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
        const eloChanges = []; // ELO değişimlerini loglamak için dizi

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

                // Eski ELO'yu al
                const oldElo = user.matchStats.elo;

                user.matchStats.totalMatches++;

                const isTeamA = match.teamA.includes(pid);
                const myTeamAvg = isTeamA ? avgEloA : avgEloB;
                const enemyTeamAvg = isTeamA ? avgEloB : avgEloA;

                // Mevcut Streak
                const currentStreak = user.matchStats.winStreak || 0;

                if (winnerTeam !== 'DRAW') {
                    const isWin = (winnerTeam === 'A' && isTeamA) || (winnerTeam === 'B' && !isTeamA);

                    if (isWin) {
                        user.matchStats.totalWins++;
                        // Win Streak Mantığı (Negatifse 1'e dön, değilse artır)
                        if (currentStreak < 0) user.matchStats.winStreak = 1;
                        else user.matchStats.winStreak = currentStreak + 1;
                    } else {
                        user.matchStats.totalLosses++;
                        // Lose Streak Mantığı (Pozitifse -1'e dön, değilse azalt)
                        if (currentStreak > 0) user.matchStats.winStreak = -1;
                        else user.matchStats.winStreak = currentStreak - 1;
                    }

                    // ELO değişikliğini hesapla
                    const eloChange = eloService.calculateMatchEloChange({
                        isWin,
                        roundDiff,
                        myTeamAvg,
                        enemyTeamAvg,
                        isMvpWinner: match.mvpPlayerId === pid,
                        isMvpLoser: match.mvpLoserId === pid,
                        currentStreak: currentStreak
                    });

                    // ELO'yu uygula (Audit log ile)
                    const reason = isWin ? `Win vs Avg:${enemyTeamAvg}` : `Loss vs Avg:${enemyTeamAvg}`;
                    await eloService.applyEloChange(user, eloChange, `Match #${match.matchNumber} | ${reason}`);

                    // Rank Rolü Senkronizasyonu
                    const member = await interaction.guild.members.fetch(pid).catch(() => null);
                    if (member) await rankHandler.syncRank(member, user.matchStats.matchLevel);

                    // Log dizisine ekle
                    eloChanges.push({
                        userId: pid,
                        oldElo: oldElo,
                        newElo: user.matchStats.elo,
                        change: eloChange,
                        reason: isWin ? 'Win' : 'Loss'
                    });
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
            const logsChannelId = '1468664219997175984';
            const logsChannel = interaction.guild.channels.cache.get(logsChannelId) || await interaction.guild.channels.fetch(logsChannelId).catch(() => null);

            if (logsChannel) {
                const winnerTeamName = winnerTeam === 'A' ? 'Blue Team' : 'Red Team';
                const mvpWinnerMention = match.mvpPlayerId ? `<@${match.mvpPlayerId}>` : 'Seçilmedi';
                const mvpLoserMention = match.mvpLoserId ? `<@${match.mvpLoserId}>` : 'Seçilmedi';

                // Lobi Bilgisi (ID'den bulmaya çalış)
                const { LOBBY_CONFIG } = require('./constants');
                const lobbyInfo = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
                const lobbyName = lobbyInfo ? lobbyInfo.name : 'Unknown Lobby';

                // Süre
                const durationMs = new Date() - match.createdAt;
                const durationMinutes = Math.floor(durationMs / 60000);

                // ELO Değişim Metni
                let eloChangesText = '';
                for (const change of eloChanges) {
                    const sign = change.change > 0 ? '+' : '';
                    const level = eloService.getLevelFromElo(change.newElo);
                    // Direkt emoji ID'si yerine formatlı stringi alalım (örn: <:level1:123...>)
                    const emoji = eloService.LEVEL_EMOJIS[level] || '';

                    eloChangesText += `${emoji} <@${change.userId}>: \`${change.oldElo}\` → \`${change.newElo}\` (**${sign}${change.change}**) [${change.reason}]\n`;
                }

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
                        { name: `📈 ELO Değişimleri`, value: eloChangesText.length > 1000 ? eloChangesText.substring(0, 1000) + '...' : eloChangesText, inline: false },
                        { name: `🔵 Team A (${match.scoreA})`, value: match.teamA.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false },
                        { name: `🔴 Team B (${match.scoreB})`, value: match.teamB.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false }
                    )
                    .setFooter({ text: `Match ID: ${match.matchId}` })
                    .setTimestamp();

                await logsChannel.send({ embeds: [logEmbed] });
            }
        } catch (e) {
            console.error("Log error:", e);
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
            // Leaderboard'u anında güncelle
            try {
                const leaderboard = require('../leaderboard');
                // Client'a erişim için interaction veya match üzerinden gitmeliyiz
                leaderboard.updateLeaderboard(interaction.client);
            } catch (err) { console.error('Leaderboard update trigger error:', err); }
        }
    }
};
