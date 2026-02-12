const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const votingHandler = require('./voting');
const eloService = require('../../services/eloService');

// Her maç için aktif timer'ı tutar
const draftTimers = new Map();

module.exports = {
    async startDraftMode(interaction, match) {
        const member = await interaction.guild.members.fetch(match.hostId).catch(() => null);
        const channel = member?.voice?.channel;

        if (!channel) return interaction.channel.send({ content: '❌ Host ses kanalında değil!' }).then(m => setTimeout(() => m.delete(), 5000));

        if (!match.lobbyVoiceId) { match.lobbyVoiceId = channel.id; await match.save(); }

        const players = channel.members
            .filter(m => !m.user.bot && m.id !== match.captainA && m.id !== match.captainB)
            .map(m => m.id);

        match.availablePlayerIds = players;
        await match.save();
        return this.updateDraftUI(interaction, match, true);
    },

    async updateDraftUI(interaction, match, sendNew = false) {
        if ((match.teamA.length >= 5 && match.teamB.length >= 5) || match.availablePlayerIds.length === 0) {
            if (draftTimers.has(match.matchId)) clearTimeout(draftTimers.get(match.matchId));

            // Kaptan isimlerini çek
            const capA = await interaction.guild.members.fetch(match.captainA).catch(() => null);
            const capB = await interaction.guild.members.fetch(match.captainB).catch(() => null);
            const nameA = capA ? capA.displayName : 'Team A';
            const nameB = capB ? capB.displayName : 'Team B';

            // Liste formatı (Genişletilmiş)
            const formatFinalTeam = (ids) => ids.map(id => `<@${id}>\u2000`).join('\n');

            const finalEmbed = new EmbedBuilder().setColor(0x2ECC71).setTitle('⚔️ KADROLAR BELİRLENDİ')
                .setDescription(`**Draft Tamamlandı!** Savaş hazırlıkları başlıyor.\n\n🔥 **Eşleşme:** \`${nameA}\` <:versus:1468000422752161844> \`${nameB}\`\nHarita oylamasına geçiliyor...`)
                .addFields(
                    { name: 'VALORANT Lobi Kodu', value: match.lobbyCode ? `\`\`\`${match.lobbyCode}\`\`\`` : 'Bekleniyor...', inline: false },
                    { name: `🔵 ${nameA}`, value: formatFinalTeam(match.teamA), inline: true },
                    { name: `🔴 ${nameB}`, value: formatFinalTeam(match.teamB), inline: true }
                )
                .setFooter({ text: 'Nexora Competitive Systems' });

            try {
                if (interaction.update) {
                    await interaction.update({ embeds: [finalEmbed], components: [] });
                } else if (interaction.message) {
                    await interaction.message.edit({ embeds: [finalEmbed], components: [] });
                }
            } catch (e) { }

            const msg = await interaction.channel.send({ content: `✅ **Harika!** Takımlar hazır, kaptanlar lütfen harita seçimine odaklanın.` });
            setTimeout(() => msg.delete().catch(() => { }), 4000);

            return votingHandler.prepareVoting(interaction, match, true);
        }

        const currentTurnCaptain = match.pickTurn === 'A' ? match.captainA : match.captainB;
        console.log(`[Draft Debug] Match ${match.matchId} - Turn: Team ${match.pickTurn} (Captain: ${currentTurnCaptain})`);
        const turnColor = match.pickTurn === 'A' ? 0x3498DB : 0xE74C3C; // Mavi veya Kırmızı
        const turnEmoji = match.pickTurn === 'A' ? '🔵' : '🔴';

        // ZAMAN AŞIMI BAŞLAT (30 Sn)
        this.startTurnTimer(interaction, match);

        const poolOptions = [];

        // Havuzdaki oyuncuların verilerini toplu çek (Performans için)
        const poolUserDocs = await User.find({ odasi: { $in: match.availablePlayerIds }, odaId: interaction.guild.id });
        const poolUserMap = new Map();
        poolUserDocs.forEach(u => poolUserMap.set(u.odasi, u));

        for (const pid of match.availablePlayerIds) {
            try {
                const p = await interaction.guild.members.fetch(pid);
                let userLevel = 1;
                let userElo = eloService.ELO_CONFIG.DEFAULT_ELO;
                const userDoc = poolUserMap.get(pid);

                if (userDoc?.matchStats) {
                    userLevel = userDoc.matchStats.matchLevel || 1;
                    userElo = userDoc.matchStats.elo || eloService.ELO_CONFIG.DEFAULT_ELO;
                }

                const levelEmojiStr = eloService.LEVEL_EMOJIS[userLevel] || eloService.LEVEL_EMOJIS[1];
                // SelectMenu için ID lazım
                const emojiId = levelEmojiStr.match(/:([0-9]+)>/)?.[1] || '1468451643355041815';

                poolOptions.push({
                    label: `${p.displayName.substring(0, 25)}`,
                    value: p.id,
                    emoji: emojiId, // SelectMenu için
                    rawEmoji: levelEmojiStr, // Text display için
                    description: `Level: ${userLevel} • ELO: ${userElo}`
                });
            } catch (e) { }
        }

        // --- TAKIM LİSTELERİ İÇİN LEVEL VERİLERİ ---
        const allTeamUsers = [...match.teamA, ...match.teamB];
        const teamUserDocs = await User.find({ odasi: { $in: allTeamUsers }, odaId: interaction.guild.id });
        const teamUserMap = new Map();
        teamUserDocs.forEach(u => teamUserMap.set(u.odasi, u));

        const getLevelEmoji = (id) => {
            const u = teamUserMap.get(id);
            const level = u?.matchStats?.matchLevel || 1;
            return eloService.LEVEL_EMOJIS[level] || eloService.LEVEL_EMOJIS[1];
        };

        // --- TAKIM LİSTELERİNİ OLUŞTUR (Slotlu ve Geniş) ---
        const formatTeam = (teamIds) => {
            const maxSlots = 5;
            const lines = [];

            for (let i = 0; i < maxSlots; i++) {
                if (teamIds[i]) {
                    const emoji = getLevelEmoji(teamIds[i]);
                    lines.push(`\`${i + 1}.\` ${emoji} <@${teamIds[i]}>`);
                }
                else lines.push(`\`${i + 1}.\` ▫️ _Boş_`);
            }
            return lines.join('\n');
        };

        const embed = new EmbedBuilder()
            .setColor(turnColor)
            .setTitle(`⚔️ [ NEXORA ] • OYUNCU SEÇİMİ`)
            .setThumbnail(match.pickTurn === 'A' ? 'https://cdn-icons-png.flaticon.com/512/3408/3408455.png' : 'https://cdn-icons-png.flaticon.com/512/3408/3408473.png') // Team colored icons
            .setDescription(
                `**Sıra:** <@${currentTurnCaptain}> (Team ${match.pickTurn})\n` +
                `Lütfen takımınıza bir oyuncu seçin.\n\n` +
                `⏰ **Kalan Süre:** <t:${Math.floor(Date.now() / 1000) + 30}:R>`
            )
            .addFields(
                { name: `🔵 Team A`, value: formatTeam(match.teamA), inline: true },
                { name: `🔴 Team B`, value: formatTeam(match.teamB), inline: true },
                {
                    name: `📍 Oyuncu Havuzu (${poolOptions.length})`,
                    value: poolOptions.length > 0
                        ? `\`\`\`yaml\n${poolOptions.map(p => `${p.label}`).join('\n')}\n\`\`\``
                        : '> *Tüm oyuncular seçildi.*',
                    inline: false
                }
            )
            .setFooter({ text: `Nexora Draft System • Match #${match.matchNumber || '?'}` });

        const components = [];
        components.push(new ActionRowBuilder().addComponents(
            poolOptions.length > 0
                ? new StringSelectMenuBuilder().setCustomId(`match_pick_${match.matchId}`).setPlaceholder(`Oyuncu Seç (Team ${match.pickTurn})`).addOptions(poolOptions.slice(0, 25))
                : new ButtonBuilder().setCustomId(`match_enddraft_${match.matchId}`).setLabel('Seçimi Bitir').setStyle(ButtonStyle.Success)
        ));

        const managementRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_undo_${match.matchId}`).setLabel('Geri Al').setStyle(ButtonStyle.Warning).setEmoji('⏪'),
            new ButtonBuilder().setCustomId(`match_resetdraft_${match.matchId}`).setLabel('Takımları Dağıt').setStyle(ButtonStyle.Danger).setEmoji('♻️'),
            new ButtonBuilder().setCustomId(`match_refresh_${match.matchId}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );
        components.push(managementRow);

        try {
            if (sendNew) {
                const msg = await interaction.channel.send({ embeds: [embed], components: components });
                match.draftMessageId = msg.id;
                await match.save();
            } else {
                // Güvenli Yanıt (Replied? Deferred?)
                if (interaction.replied || interaction.deferred) {
                    if (interaction.message) await interaction.update({ content: null, embeds: [embed], components: components });
                    else await interaction.channel.send({ embeds: [embed], components: components }); // Fallback
                } else {
                    await interaction.update({ content: null, embeds: [embed], components: components });
                }
            }
        } catch (e) { console.error("Update Draft UI Error:", e); }
    },

    startTurnTimer(interaction, match) {
        if (draftTimers.has(match.matchId)) clearTimeout(draftTimers.get(match.matchId));

        const channel = interaction.channel;

        const timer = setTimeout(async () => {
            await this.handleAutoPick(channel, match.matchId);
        }, 30 * 1000);

        draftTimers.set(match.matchId, timer);
    },

    async handleAutoPick(channel, matchId) {
        const match = await Match.findOne({ matchId });
        if (!match || match.status !== 'DRAFT') return;

        if (match.availablePlayerIds.length === 0) return;

        const randomPlayer = match.availablePlayerIds[Math.floor(Math.random() * match.availablePlayerIds.length)];

        if (match.pickTurn === 'A') {
            match.teamA.push(randomPlayer);
            match.lastPickTeam = 'A'; // Sistem A takımına seçti, A kaptanı geri alabilir
            match.pickTurn = 'B';
        } else {
            match.teamB.push(randomPlayer);
            match.lastPickTeam = 'B'; // Sistem B takımına seçti, B kaptanı geri alabilir
            match.pickTurn = 'A';
        }

        match.availablePlayerIds = match.availablePlayerIds.filter(id => id !== randomPlayer);
        await match.save();

        if (channel) {
            const notification = await channel.send({ content: `⏳ **Süre Doldu!**\nSistem otomatik olarak **<@${randomPlayer}>** oyuncusunu seçti.` });
            setTimeout(() => notification.delete().catch(() => { }), 5000);

            let draftMsg;
            if (match.draftMessageId) {
                try { draftMsg = await channel.messages.fetch(match.draftMessageId); } catch (e) { }
            }

            if (draftMsg) {
                const dummyInteraction = {
                    channel: channel,
                    guild: channel.guild,
                    user: { id: "SYSTEM" },
                    replied: true,
                    deferred: false,
                    isMessageComponent: () => true,
                    update: async (payload) => await draftMsg.edit(payload),
                    message: draftMsg
                };
                await this.updateDraftUI(dummyInteraction, match, false);
            } else {
                const dummyInteraction = {
                    channel: channel,
                    guild: channel.guild,
                    user: { id: "SYSTEM" },
                    replied: false,
                    deferred: false,
                    isMessageComponent: () => false
                };
                await this.updateDraftUI(dummyInteraction, match, true);
            }
        }
    },

    async handlePlayerPick(interaction) {
        try {
            const matchId = interaction.customId.split('_')[2];
            const match = await Match.findOne({ matchId });
            if (!match) {
                const { MessageFlags } = require('discord.js');
                return interaction.reply({ content: 'Maç bulunamadı.', flags: MessageFlags.Ephemeral });
            }

            const currentCap = match.pickTurn === 'A' ? match.captainA : match.captainB;
            if (interaction.user.id !== currentCap) {
                const { MessageFlags } = require('discord.js');
                return interaction.reply({ content: 'Sıra sende değil!', flags: MessageFlags.Ephemeral });
            }

            const pickedId = interaction.values[0];
            if (match.pickTurn === 'A') {
                match.teamA.push(pickedId);
                match.lastPickTeam = 'A';
                match.pickTurn = 'B';
            } else {
                match.teamB.push(pickedId);
                match.lastPickTeam = 'B';
                match.pickTurn = 'A';
            }

            match.availablePlayerIds = match.availablePlayerIds.filter(id => id !== pickedId);
            await match.save();
            await this.updateDraftUI(interaction, match);
        } catch (e) {
            console.error('handlePlayerPick error:', e);
        }
    },

    async refreshDraftUI(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        try {
            const host = await interaction.guild.members.fetch(match.hostId);
            const channel = host?.voice?.channel;
            if (channel) {
                const currentPlayers = [...match.teamA, ...match.teamB];
                const newPool = channel.members.filter(m => !m.user.bot && !currentPlayers.includes(m.id)).map(m => m.id);
                match.availablePlayerIds = newPool;
                await match.save();
            }
        } catch (e) {
            console.error('Refresh error:', e.message);
        }

        await this.updateDraftUI(interaction, match);
    },

    async handleUndoPick(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        // Yetki kontrolü: Sadece son seçen kaptan
        const lastCap = match.lastPickTeam === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== lastCap) {
            return interaction.reply({ content: '❌ Sadece son seçimi yapan kaptan geri alabilir!', flags: MessageFlags.Ephemeral });
        }

        // Limit kontrolü
        if (match.undoCount >= 2) {
            return interaction.reply({ content: '⚠️ **Hata:** Geri alma hakkınız kalmadı! (Limit: 2)', flags: MessageFlags.Ephemeral });
        }

        if (!match.lastPickTeam) {
            return interaction.reply({ content: '❌ Geri alınacak bir seçim bulunamadı.', flags: MessageFlags.Ephemeral });
        }

        // Geri Al İşlemi
        const team = match.lastPickTeam === 'A' ? match.teamA : match.teamB;
        if (team.length <= 1) { // Sadece kaptan kaldıysa (kaptanlar team'in ilk elemanı)
            return interaction.reply({ content: '❌ Takımda geri alınacak oyuncu yok.', flags: MessageFlags.Ephemeral });
        }

        const removedPlayerId = team.pop();
        match.availablePlayerIds.push(removedPlayerId);
        match.pickTurn = match.lastPickTeam; // Sırayı geri ver
        match.lastPickTeam = null; // Zincirleme geri alma engeli (tek tek geri alım için state sıfırlanmalı)
        match.undoCount++;
        await match.save();

        await interaction.reply({ content: `⏪ **Geri Alındı:** <@${removedPlayerId}> havuza döndü. (${match.undoCount}/2)`, flags: MessageFlags.Ephemeral });
        await this.updateDraftUI(interaction, match);
    },

    async handleResetTeams(interaction) {
        const { MessageFlags } = require('discord.js');
        const REQUIRED_ROLE_ID = '1463875325019557920';

        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Bu işlemi sadece yetkililer yapabilir.', flags: MessageFlags.Ephemeral });
        }

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        // Ses kanalındaki herkesi çek (oyuncuları havuza döndürmek için)
        const member = await interaction.guild.members.fetch(match.hostId).catch(() => null);
        const channel = member?.voice?.channel;

        if (channel) {
            const players = channel.members
                .filter(m => !m.user.bot && m.id !== match.captainA && m.id !== match.captainB)
                .map(m => m.id);
            match.availablePlayerIds = players;
        }

        match.teamA = [match.captainA];
        match.teamB = [match.captainB];
        match.pickTurn = 'A';
        match.undoCount = 0;
        match.lastPickTeam = null;
        await match.save();

        await interaction.reply({ content: '♻️ **Takımlar Dağıtıldı!** Kaptanlar hariç herkes havuza döndü.', flags: MessageFlags.Ephemeral });
        await this.updateDraftUI(interaction, match);
    }
};
