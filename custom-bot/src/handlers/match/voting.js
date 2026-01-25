const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, PermissionsBitField, ChannelType
} = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS, getCategoryId } = require('./constants');
const gameHandler = require('./game');

const { createVoteResultImage } = require('../../utils/matchCanvas');
const { AttachmentBuilder } = require('discord.js');

module.exports = {
    // ... (prepareVoting aynı)

    async startMapVoting(channel, match) {
        const mapsToVote = MAPS;
        const endUnix = Math.floor(match.voteEndTime.getTime() / 1000);
        const totalPlayers = match.teamA.length + match.teamB.length;

        // İLK GÖRSEL (Boş)
        const allMapNames = mapsToVote.map(m => m.name);
        let buffer;
        try {
            buffer = await createVoteResultImage(allMapNames, {});
        } catch (e) { console.error('Canvas Vote Error:', e); }

        const attachment = buffer ? new AttachmentBuilder(buffer, { name: 'voting.png' }) : null;

        const embed = new EmbedBuilder().setColor(0xFFA500).setTitle('🗳️ Harita Oylaması')
            .setDescription(`Oynamak istediğiniz haritayı seçin!\n\n⏳ **Bitiş:** <t:${endUnix}:R>`)
            .setImage('attachment://voting.png') // Resmi embed içine göm
            .setFooter({ text: `🗳️ Oy Durumu: 0/${totalPlayers}` });

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`match_vote_${match.matchId}`).setPlaceholder('Haritanı Seç!').addOptions(options));

        const msgPayload = { content: '@here', embeds: [embed], components: [row] };
        if (attachment) msgPayload.files = [attachment];

        const msg = await channel.send(msgPayload);

        // Mesaj ID sakla ki edit yapabilelim
        match.votingMessageId = msg.id;
        await match.save();

        // Timer
        setTimeout(() => this.endVoting(channel, match.matchId), 60000);
    },

    async handleMapVote(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return interaction.reply({ content: 'Oylama aktif değil.', ephemeral: true });

        const selectedMap = interaction.values[0];
        const userId = interaction.user.id;

        match.votes = match.votes.filter(v => v.userId !== userId);
        match.votes.push({ userId, mapName: selectedMap });
        await match.save();
        await interaction.reply({ content: `✅ Oyunuz **${selectedMap}** için kaydedildi.`, ephemeral: true });

        // GÖRSEL GÜNCELLE
        const totalPlayers = match.teamA.length + match.teamB.length;

        try {
            const votingMsg = await interaction.channel.messages.fetch(match.votingMessageId);
            if (votingMsg) {
                const counts = {};
                match.votes.forEach(v => counts[v.mapName] = (counts[v.mapName] || 0) + 1);
                const allMapNames = MAPS.map(m => m.name);

                const buffer = await createVoteResultImage(allMapNames, counts);
                const attachment = new AttachmentBuilder(buffer, { name: 'voting.png' });

                const embed = EmbedBuilder.from(votingMsg.embeds[0]);
                embed.setFooter({ text: `🗳️ Oy Durumu: ${match.votes.length}/${totalPlayers}` });
                embed.setImage('attachment://voting.png'); // Gerekli mi? Evet, çünkü yeni dosya adı aynı ama içerik farklı

                await votingMsg.edit({ embeds: [embed], files: [attachment] });
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

        const counts = {};
        match.votes.forEach(v => { counts[v.mapName] = (counts[v.mapName] || 0) + 1; });
        const sortedMaps = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        if (sortedMaps.length === 0) {
            match.selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)].name;
            channel.send(`⚠️ Kimse oy kullanmadı. Rastgele: **${match.selectedMap}**`);
        } else {
            const topMap = sortedMaps[0];
            if (sortedMaps.length > 1 && sortedMaps[1][1] === topMap[1]) {
                channel.send(`⚖️ **Beraberlik!** Rastgele seçim yapılıyor...`);
                const tied = sortedMaps.filter(m => m[1] === topMap[1]);
                match.selectedMap = tied[Math.floor(Math.random() * tied.length)][0];
            } else { match.selectedMap = topMap[0]; }
            channel.send(`✅ **Kazanan:** **${match.selectedMap}** (${topMap[1]} oy)`);
        }

        match.voteStatus = 'FINISHED'; await match.save();

        // Game Handler'a geç
        gameHandler.startSideSelection(channel, match);
    }
};
