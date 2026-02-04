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
        for (const pid of match.availablePlayerIds) {
            try {
                const p = await interaction.guild.members.fetch(pid);

                // Level ve ELO bilgisini çek (eloService kullanarak)
                let userLevel = eloService.ELO_CONFIG.DEFAULT_LEVEL;
                let userElo = eloService.ELO_CONFIG.DEFAULT_ELO;

                try {
                    const userDoc = await User.findOne({ odasi: pid, odaId: interaction.guild.id });
                    if (userDoc) {
                        eloService.ensureValidStats(userDoc);
                        userLevel = userDoc.matchStats.matchLevel;
                        userElo = userDoc.matchStats.elo;
                    }
                } catch (err) { }

                const LEVEL_EMOJIS = {
                    1: '1468451643355041815',
                    2: '1468451665265819749',
                    3: '1468451677295345829',
                    4: '1468451696693743729',
                    5: '1468451709754933389',
                    6: '1468451723071717426',
                    7: '1468451735478472923',
                    8: '1468451750813110312',
                    9: '1468451768009621525',
                    10: '1468451780777214185'
                };

                poolOptions.push({
                    label: `${p.displayName.substring(0, 25)}`,
                    value: p.id,
                    emoji: LEVEL_EMOJIS[userLevel] || '1468451643355041815', // Varsayılan Level 1
                    description: `Level: ${userLevel} • ELO: ${userElo}`
                });
            } catch (e) { }
        }

        const nextTime = Math.floor(Date.now() / 1000) + 30;

        // --- TAKIM LİSTELERİNİ OLUŞTUR (Slotlu ve Geniş) ---
        const formatTeam = (teamIds) => {
            const maxSlots = 5;
            const lines = [];
            const padding = '\u2000\u2000\u2000\u2000';

            for (let i = 0; i < maxSlots; i++) {
                if (teamIds[i]) lines.push(`\`${i + 1}.\` <@${teamIds[i]}>${padding}`);
                else lines.push(`\`${i + 1}.\` ▫️ _Boş_${padding}`);
            }
            return lines.join('\n');
        };

        const embed = new EmbedBuilder().setColor(turnColor)
            .setTitle(`${turnEmoji} OYUNCU SEÇİMİ`)
            .setDescription(`**Sıra:** <@${currentTurnCaptain}> (Team ${match.pickTurn}) **seçiyor.**\n⏰ **Süre:** <t:${nextTime}:R>`)
            .addFields(
                { name: `🔵 Team A`, value: formatTeam(match.teamA), inline: true },
                { name: `🔴 Team B`, value: formatTeam(match.teamB), inline: true },
                { name: `📍 Havuzda Bekleyenler (${poolOptions.length})`, value: poolOptions.length > 0 ? poolOptions.map(p => p.label).join(', ') : '⚠️ Kimse kalmadı', inline: false }
            )
            .setFooter({ text: `Nexora Draft System • Match #${match.matchNumber || '?'}` });

        const components = [];
        components.push(new ActionRowBuilder().addComponents(
            poolOptions.length > 0
                ? new StringSelectMenuBuilder().setCustomId(`match_pick_${match.matchId}`).setPlaceholder(`Oyuncu Seç (Team ${match.pickTurn})`).addOptions(poolOptions.slice(0, 25))
                : new ButtonBuilder().setCustomId(`match_enddraft_${match.matchId}`).setLabel('Seçimi Bitir').setStyle(ButtonStyle.Success)
        ));
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_refresh_${match.matchId}`).setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        ));

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

        if (match.pickTurn === 'A') { match.teamA.push(randomPlayer); match.pickTurn = 'B'; }
        else { match.teamB.push(randomPlayer); match.pickTurn = 'A'; }

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
            if (match.pickTurn === 'A') { match.teamA.push(pickedId); match.pickTurn = 'B'; }
            else { match.teamB.push(pickedId); match.pickTurn = 'A'; }

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
    }
};
