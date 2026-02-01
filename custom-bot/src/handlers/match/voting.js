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
        match.votingMessageId = null;
        await match.save();

        this.startMapVoting(interaction.channel, match);
    },

    async startMapVoting(channel, match) {
        // Oynanmış haritaları filtrele
        const played = match.playedMaps || [];
        const mapsToVote = MAPS.filter(m => !played.includes(m.name));

        const endUnix = Math.floor(match.voteEndTime.getTime() / 1000);
        const totalPlayers = match.teamA.length + match.teamB.length;

        const embed = new EmbedBuilder().setColor(0xFFA500).setTitle('🗳️ Harita Oylaması')
            .setDescription(`Oynamak istediğiniz haritayı seçin!\n\n⏳ **Bitiş:** <t:${endUnix}:R>`)
            .setFooter({ text: `🗳️ Oy Durumu: 0/${totalPlayers} • Made by Swaff` });

        if (played.length > 0) {
            embed.addFields({ name: '🚫 Oynanmış Haritalar', value: played.join(', ') });
        }

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        // Eğer tüm haritalar oynandıysa sıfırla veya hepsi açık
        const finalOptions = options.length > 0 ? options : MAPS.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
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
                embed.setFooter({ text: `🗳️ Oy Durumu: ${match.votes.length}/${totalPlayers} • Made by Swaff` });
                await votingMsg.edit({ embeds: [embed] });
            }
        } catch (e) {
            if (e.code !== 10008) console.error('Vote Update Error:', e);
        }

        if (match.votes.length >= totalPlayers) {
            const doneMsg = await interaction.channel.send('⚡ **Herkes oy kullandı! Oylama sonlandırılıyor...**');
            setTimeout(() => doneMsg.delete().catch(() => { }), 5000);
            await this.endVoting(interaction.channel, match.matchId);
        }
    },

    async endVoting(channel, matchId) {
        try {
            const match = await Match.findOneAndUpdate(
                { matchId, voteStatus: 'VOTING' },
                { $set: { voteStatus: 'FINISHED' } },
                { new: true }
            );
            if (!match) return;

            // KANAL KONTROLÜ (Güvenli Erişim)
            if (channel.guild) {
                const fetched = await channel.guild.channels.fetch(channel.id).catch(() => null);
                if (!fetched) return; // Kanal silinmiş
                channel = fetched;
            }

            // TEMİZLİK: Oylama mesajını sil
            if (match.votingMessageId) {
                const msg = await channel.messages.fetch(match.votingMessageId).catch(() => null);
                if (msg) await msg.delete().catch(() => { });
            }

            const counts = {};
            match.votes.forEach(v => { counts[v.mapName] = (counts[v.mapName] || 0) + 1; });
            const sortedMaps = Object.entries(counts).sort((a, b) => b[1] - a[1]);

            let resMsg;
            if (sortedMaps.length === 0) {
                match.selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)].name;
                resMsg = await channel.send(`⚠️ Kimse oy kullanmadı. Rastgele: **${match.selectedMap}**`).catch(() => null);
            } else {
                const topMap = sortedMaps[0];
                if (sortedMaps.length > 1 && sortedMaps[1][1] === topMap[1]) {
                    const tied = sortedMaps.filter(m => m[1] === topMap[1]);
                    const tiedMapNames = tied.map(t => t[0]);

                    const winnerMap = tied[Math.floor(Math.random() * tied.length)][0];
                    match.selectedMap = winnerMap;

                    resMsg = await channel.send({
                        content: `⚖️ **OYLAMA SONUCU EŞİT!**\n\n📌 Eşit Oy Alanlar: **${tiedMapNames.join(', ')}**\n🎲 Sistem tarafından rastgele seçilen harita: **${match.selectedMap}**`
                    }).catch(() => null);
                } else {
                    match.selectedMap = topMap[0];
                    resMsg = await channel.send(`✅ **Kazanan Harita:** **${match.selectedMap}** (${topMap[1]} oy)`).catch(() => null);
                }
            }

            // Sonuç mesajını 5 saniye sonra sil
            if (resMsg) setTimeout(() => resMsg.delete().catch(() => { }), 5000);

            await match.save();

            // Game Handler'a geç
            gameHandler.startSideSelection(channel, match);
        } catch (error) {
            // Hata olursa (Kanal yoksa vb.) sessiz kal
            // console.error('EndVoting Error:', error);
        }
    }
};
