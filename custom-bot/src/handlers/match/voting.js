const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, PermissionsBitField, ChannelType
} = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS, getCategoryId } = require('./constants');
const gameHandler = require('./game');

module.exports = {
    async prepareVoting(interaction, match, deleteMsg = true) {
        match.status = 'VOTING';
        match.voteStatus = 'VOTING';
        match.voteEndTime = new Date(Date.now() + 60000);
        await match.save();

        if (deleteMsg && interaction.message) {
            await interaction.message.delete().catch(() => { });
        }

        const embedInit = new EmbedBuilder().setColor(0x57F287).setTitle('🗳️ Oylama Odası Hazırlanıyor...').setDescription('Harita oylamasına geçiliyor.');
        const infoMsg = await interaction.channel.send({ embeds: [embedInit] });
        setTimeout(() => infoMsg.delete().catch(() => { }), 5000);

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;
        const allPlayers = [...match.teamA, ...match.teamB];

        const MATCH_CATEGORY_ID = getCategoryId();
        const votingChannel = await guild.channels.create({
            name: `🗳️・map-voting`,
            type: ChannelType.GuildText,
            parent: MATCH_CATEGORY_ID,
            permissionOverwrites: [
                { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...allPlayers.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
            ]
        });

        match.createdChannelIds.push(votingChannel.id);
        match.channelId = votingChannel.id;
        await match.save();
        this.startMapVoting(votingChannel, match);
    },

    async startMapVoting(channel, match) {
        const mapsToVote = MAPS;
        const endUnix = Math.floor(match.voteEndTime.getTime() / 1000);
        const totalPlayers = match.teamA.length + match.teamB.length;

        const embed = new EmbedBuilder().setColor(0xFFA500).setTitle('🗳️ Harita Oylaması')
            .setDescription(`Oynamak istediğiniz haritayı seçin!\n\n⏳ **Bitiş:** <t:${endUnix}:R>`)
            .addFields({ name: 'Aday Haritalar', value: mapsToVote.map(m => `• ${m.name}`).join('\n') })
            .setFooter({ text: `🗳️ Oy Durumu: 0/${totalPlayers}` });

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`match_vote_${match.matchId}`).setPlaceholder('Haritanı Seç!').addOptions(options));

        await channel.send({ content: '@here', embeds: [embed], components: [row] });

        // Timer
        setTimeout(() => this.endVoting(channel, match.matchId), 60000);
    },

    async handleMapVote(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return interaction.reply({ content: 'Oylama aktif değil.', ephemeral: true });

        const selectedMap = interaction.values[0];
        const userId = interaction.user.id;

        match.votes = match.votes.filter(v => v.userId !== userId); // Varsa eskisini sil (gerçi menüde değiştiremez ama kod sağlam olsun)
        match.votes.push({ userId, mapName: selectedMap });
        await match.save();
        await interaction.reply({ content: `✅ Oyunuz **${selectedMap}** için kaydedildi.`, ephemeral: true });

        // Erken Bitiş ve Sayaç Güncelleme
        const totalPlayers = match.teamA.length + match.teamB.length;

        try {
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.setFooter({ text: `🗳️ Oy Durumu: ${match.votes.length}/${totalPlayers}` });
            await interaction.message.edit({ embeds: [embed] });
        } catch (e) { }

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
