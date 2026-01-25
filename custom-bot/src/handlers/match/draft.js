const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const votingHandler = require('./voting');
const { createLobbyImage } = require('../../utils/matchCanvas');

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
            // Timer temizle
            if (draftTimers.has(match.matchId)) clearTimeout(draftTimers.get(match.matchId));

            // --- GÖRSEL LOBBY OLUŞTUR ---
            try {
                const getMemberData = async (id) => {
                    try {
                        const m = await interaction.guild.members.fetch(id);
                        return { username: m.displayName, avatarURL: m.user.displayAvatarURL({ extension: 'png', forceStatic: true }) };
                    } catch { return { username: 'Unknown', avatarURL: null }; }
                };

                const teamAData = await Promise.all(match.teamA.map(getMemberData));
                const teamBData = await Promise.all(match.teamB.map(getMemberData));

                const buffer = await createLobbyImage(teamAData, teamBData);
                const attachment = new AttachmentBuilder(buffer, { name: 'lobby.png' });

                await interaction.channel.send({ content: `✅ **Takımlar Belirlendi!** Map Veto Moduna Geçiliyor...`, files: [attachment] });

            } catch (canvasErr) {
                console.error('Canvas Error:', canvasErr);
            }

            return votingHandler.prepareVoting(interaction, match, true);
        }

        const currentTurnCaptain = match.pickTurn === 'A' ? match.captainA : match.captainB;

        // ZAMAN AŞIMI BAŞLAT (30 Sn)
        this.startTurnTimer(interaction, match);

        const poolOptions = [];
        for (const pid of match.availablePlayerIds) {
            try {
                const p = await interaction.guild.members.fetch(pid);
                poolOptions.push({ label: p.displayName.substring(0, 25), value: p.id, emoji: '👤' });
            } catch (e) { }
        }

        // Zaman bilgisini embed'e ekle
        const nextTime = Math.floor(Date.now() / 1000) + 30;

        const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('👥 Draft Aşaması')
            .setDescription(`**Sıra:** <@${currentTurnCaptain}> (Team ${match.pickTurn})\n⏰ **Süre Bitişi:** <t:${nextTime}:R>`)
            .addFields(
                { name: `🔵 Team A (${match.teamA.length})`, value: match.teamA.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: `🔴 Team B (${match.teamB.length})`, value: match.teamB.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: '📍 Havuz', value: poolOptions.length > 0 ? poolOptions.map(p => p.label).join(', ') : 'Kimse kalmadı', inline: false }
            );

        const components = [];
        components.push(new ActionRowBuilder().addComponents(
            poolOptions.length > 0
                ? new StringSelectMenuBuilder().setCustomId(`match_pick_${match.matchId}`).setPlaceholder(`Oyuncu Seç (Team ${match.pickTurn})`).addOptions(poolOptions.slice(0, 25))
                : new ButtonBuilder().setCustomId(`match_enddraft_${match.matchId}`).setLabel('Seçimi Bitir').setStyle(ButtonStyle.Success)
        ));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_refresh_${match.matchId}`).setLabel('🔄 Yenile').setStyle(ButtonStyle.Secondary)));

        try {
            if (sendNew) {
                await interaction.channel.send({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
            } else {
                // Eğer interaction cevaplanmamışsa update, cevaplanmışsa editReply veya yeni mesaj denemesi
                if (interaction.replied || interaction.deferred) {
                    // interaction.message varsa edit, yoksa channel send
                    if (interaction.message) await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
                    else await interaction.channel.send({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
                } else {
                    if (interaction.isMessageComponent()) await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
                    else await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
                }
            }
        } catch (e) { console.error("Update Draft UI Error:", e); }
    },

    startTurnTimer(interaction, match) {
        // Eski timer'ı iptal et
        if (draftTimers.has(match.matchId)) clearTimeout(draftTimers.get(match.matchId));

        // Kanalı garantiye al (interaction veya DB'den)
        // AutoPick tetiklenirse interaction objesi olmayabilir, o yüzden kanalı bulmamız lazım.
        // Ama timer callback içinde interaction objesini kullanmak riskli (süresi dolmuş olabilir).
        // En iyisi kanalı bulup saklamak.

        const channel = interaction.channel;

        const timer = setTimeout(async () => {
            await this.handleAutoPick(channel, match.matchId); // interaction değil channel yolluyoruz
        }, 30 * 1000); // 30 Saniye

        draftTimers.set(match.matchId, timer);
    },

    async handleAutoPick(channel, matchId) {
        const match = await Match.findOne({ matchId });
        if (!match || match.status !== 'DRAFT') return;

        // Rastgele seçim
        if (match.availablePlayerIds.length === 0) return; // Kimse yok

        const randomPlayer = match.availablePlayerIds[Math.floor(Math.random() * match.availablePlayerIds.length)];

        // Takıma ekle
        if (match.pickTurn === 'A') { match.teamA.push(randomPlayer); match.pickTurn = 'B'; }
        else { match.teamB.push(randomPlayer); match.pickTurn = 'A'; }

        match.availablePlayerIds = match.availablePlayerIds.filter(id => id !== randomPlayer);
        await match.save();

        if (channel) await channel.send(`⏳ **Süre doldu!** <@${randomPlayer}> otomatik seçildi.`);

        // UI Güncelle (sahte interaction ile veya direkt channel.send ile)
        // updateDraftUI genelde interaction bekler, ama biz channel gönderip sendNew=true diyebiliriz.
        // ama updateDraftUI channel.send yapacaksa 'sendNew' mantığı biraz değişmeli.
        // Fake interaction objesi yapmak lazım.

        const fakeInteraction = {
            channel: channel,
            guild: channel.guild,
            replied: true, // Zaten reply edildi varsay ki yeni mesaj atsın
            deferred: true,
            isMessageComponent: () => false,
            update: () => { }, // Boş
            reply: () => { },
            channelId: channel.id
        };

        // sendNew=true yaparak yeni mesaj attıralım
        await this.updateDraftUI(fakeInteraction, match, true);
    },

    async handlePlayerPick(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

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
    },

    async refreshDraftUI(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        // Timer'ı resetle (refresh basınca süre sıfırlanır mı? Hayır, kötüye kullanım olur. Timer devam etsin.)
        // Ama timer'ı yeniden başlatmak gerekmiyor.

        const host = await interaction.guild.members.fetch(match.hostId);
        const channel = host.voice.channel;
        if (channel) {
            const currentPlayers = [...match.teamA, ...match.teamB];
            const newPool = channel.members.filter(m => !m.user.bot && !currentPlayers.includes(m.id)).map(m => m.id);
            match.availablePlayerIds = newPool;
            await match.save();
        }
        await this.updateDraftUI(interaction, match);
    }
};
