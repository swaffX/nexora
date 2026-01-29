const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, PermissionsBitField, ChannelType
} = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS, getCategoryId } = require('./constants');
const gameHandler = require('./game');

const { AttachmentBuilder } = require('discord.js');

module.exports = {
    async prepareVoting(interaction, match, isNewMessage = false) {
        match.voteStatus = 'VOTING';
        match.voteEndTime = new Date(Date.now() + 60000); // 1 Dakika
        match.votes = [];
        match.selectedMap = null;
        await match.save();

        this.startMapVoting(interaction.channel, match);
    },

    async startMapVoting(channel, match) {
        const mapsToVote = MAPS;
        const endUnix = Math.floor(match.voteEndTime.getTime() / 1000);
        const totalPlayers = match.teamA.length + match.teamB.length;

        const embed = new EmbedBuilder().setColor(0xFFA500).setTitle('🗳️ Harita Oylaması')
            .setDescription(`Oynamak istediğiniz haritayı seçin!\n\n⏳ **Bitiş:** <t:${endUnix}:R>`)
            .setFooter({ text: `🗳️ Oy Durumu: 0/${totalPlayers}` });

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`match_vote_${match.matchId}`).setPlaceholder('Haritanı Seç!').addOptions(options));
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('Maçı İptal Et').setEmoji('🛑').setStyle(ButtonStyle.Danger));

        const msg = await channel.send({ embeds: [embed], components: [row, row2] });

        // Mesaj ID sakla ki edit yapabilelim
        match.votingMessageId = msg.id;
        await match.save();

        // Timer
        setTimeout(() => this.endVoting(channel, match.matchId), 60000);
    },

    async handleMapVote(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return interaction.reply({ content: 'Oylama aktif değil.', flags: MessageFlags.Ephemeral });

        const selectedMap = interaction.values[0];
        const userId = interaction.user.id;

        match.votes = match.votes.filter(v => v.userId !== userId);
        match.votes.push({ userId, mapName: selectedMap });
        await match.save();
        await interaction.reply({ content: `✅ Oyunuz **${selectedMap}** için kaydedildi.`, flags: MessageFlags.Ephemeral });

        // GÖRSEL GÜNCELLE
        const totalPlayers = match.teamA.length + match.teamB.length;

        try {
            const votingMsg = await interaction.channel.messages.fetch(match.votingMessageId);
            if (votingMsg && votingMsg.embeds && votingMsg.embeds.length > 0) {
                const embed = EmbedBuilder.from(votingMsg.embeds[0]);
                embed.setFooter({ text: `🗳️ Oy Durumu: ${match.votes.length}/${totalPlayers}` });
                await votingMsg.edit({ embeds: [embed] });
            }
        } catch (e) { console.error('Vote Update Error:', e); }

        if (match.votes.length >= totalPlayers) {
            await interaction.channel.send('⚡ **Herkes oy kullandı! Oylama sonlandırılıyor...**');
            await this.endVoting(interaction.channel, match.matchId);
        }
    },

    async endVoting(channel, matchId) {
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return;

        // TEMİZLİK: Oylama mesajını sil
        try {
            if (match.votingMessageId) {
                const msg = await channel.messages.fetch(match.votingMessageId).catch(() => null);
                if (msg) await msg.delete();
            }
        } catch (e) { console.error('Delete Vote Msg Error:', e); }

        const counts = {};
        match.votes.forEach(v => { counts[v.mapName] = (counts[v.mapName] || 0) + 1; });
        const sortedMaps = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        if (sortedMaps.length === 0) {
            match.selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)].name;
            channel.send(`⚠️ Kimse oy kullanmadı. Rastgele: **${match.selectedMap}**`);
        } else {
            const topMap = sortedMaps[0];
            if (sortedMaps.length > 1 && sortedMaps[1][1] === topMap[1]) {
                const tied = sortedMaps.filter(m => m[1] === topMap[1]);
                const tiedMapNames = tied.map(t => t[0]);

                // Eşitlik durumunda sistem otomatik seçim yapar
                const winnerMap = tied[Math.floor(Math.random() * tied.length)][0];
                match.selectedMap = winnerMap;

                await channel.send({
                    content: `⚖️ **OYLAMA SONUCU EŞİT!**\n\n📌 Eşit Oy Alanlar: **${tiedMapNames.join(', ')}**\n🎲 Sistem tarafından rastgele seçilen harita: **${match.selectedMap}**`
                });
            } else {
                match.selectedMap = topMap[0];
                await channel.send(`✅ **Kazanan Harita:** **${match.selectedMap}** (${topMap[1]} oy)`);
            }
        }

        match.voteStatus = 'FINISHED'; await match.save();

        // Game Handler'a geç
        gameHandler.startSideSelection(channel, match);
    }
};
