const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    StringSelectMenuBuilder, PermissionsBitField, ChannelType
} = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS } = require('./constants');
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

        const totalPlayers = match.teamA.length + match.teamB.length;

        // 1. Participant Data Hazırla
        const allPlayersData = [];
        const allPlayers = [...match.teamA, ...match.teamB];
        const votedIds = match.votes.map(v => v.userId);

        for (const pid of allPlayers) {
            const member = await channel.guild.members.fetch(pid).catch(() => null);
            allPlayersData.push({
                id: pid,
                name: member?.displayName || 'Unknown',
                avatar: member?.user.displayAvatarURL({ extension: 'png', size: 128 }),
                hasVoted: votedIds.includes(pid)
            });
        }

        // 2. Vote Counts Hazırla
        const votedMaps = {};
        match.votes.forEach(v => { votedMaps[v.mapName] = (votedMaps[v.mapName] || 0) + 1; });

        // 3. Canvas Oluştur
        const canvasGenerator = require('../../utils/canvasGenerator');
        const buffer = await canvasGenerator.createMapVotingImage(votedMaps, allPlayersData, match);
        const fileName = `map-voting-${Date.now()}.png`;
        const attachment = new AttachmentBuilder(buffer, { name: fileName });

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🗳️ [ NEXORA ] • HARİTA OYLAMASI')
            .setDescription(
                `**Mücadele hangi haritada geçecek?**\n` +
                `Favori haritanı seçerek takımına destek ol!\n\n` +
                `⏰ **Oylama Süresi:** 60 saniye`
            )
            .setImage(`attachment://${fileName}`)
            .setFooter({ text: `Nexora Voting • 0/${totalPlayers} Oy Kullanıldı` });

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        const finalOptions = options.length > 0 ? options : MAPS.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`match_vote_${match.matchId}`)
                .setPlaceholder(' Favori haritanı seç!')
                .addOptions(finalOptions)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('Maçı İptal Et').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );

        const msg = await channel.send({ embeds: [embed], components: [row, row2], files: [attachment] });

        match.votingMessageId = msg.id;
        await match.save();

        setTimeout(() => this.endVoting(channel, match.matchId), 60000);
    },

    async handleMapVote(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return interaction.reply({ content: 'Oylama aktif değil.', flags: MessageFlags.Ephemeral });

        const userId = interaction.user.id;
        const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];

        // SADECE TAKIM OYUNCULARI OY KULLANABİLİR
        if (!allPlayers.includes(userId)) {
            return interaction.reply({
                content: '⛔ **Hata:** Oylamaya sadece takımlara seçilmiş oyuncular katılabilir!',
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedMap = interaction.values[0];

        match.votes = match.votes.filter(v => v.userId !== userId);
        match.votes.push({ userId, mapName: selectedMap });
        await match.save();
        await interaction.reply({ content: `<a:tik:1242549144887754853> Oyunuz **${selectedMap}** için kaydedildi.`, flags: MessageFlags.Ephemeral });

        // GÖRSEL GÜNCELLE
        const totalPlayers = match.teamA.length + match.teamB.length;
        const votedIds = match.votes.map(v => v.userId);

        const allPlayersData = [];
        for (const pid of allPlayers) {
            const member = await interaction.guild.members.fetch(pid).catch(() => null);
            allPlayersData.push({
                id: pid,
                name: member?.displayName || 'Unknown',
                avatar: member?.user.displayAvatarURL({ extension: 'png', size: 128 }),
                hasVoted: votedIds.includes(pid)
            });
        }

        const votedMaps = {};
        match.votes.forEach(v => { votedMaps[v.mapName] = (votedMaps[v.mapName] || 0) + 1; });

        try {
            const votingMsg = await interaction.channel.messages.fetch(match.votingMessageId);
            if (votingMsg) {
                const canvasGenerator = require('../../utils/canvasGenerator');
                const buffer = await canvasGenerator.createMapVotingImage(votedMaps, allPlayersData, match);
                const fileName = `map-voting-${Date.now()}.png`;
                const attachment = new AttachmentBuilder(buffer, { name: fileName });

                const oldEmbed = votingMsg.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .setImage(`attachment://${fileName}`)
                    .setFooter({ text: `Nexora Voting • ${match.votes.length}/${totalPlayers} Oy Kullanıldı` });

                await votingMsg.edit({
                    embeds: [newEmbed],
                    files: [attachment],
                    attachments: [] // Clear previous
                });
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
                    resMsg = await channel.send(`<a:tik:1242549144887754853> **Kazanan Harita:** **${match.selectedMap}** (${topMap[1]} oy)`).catch(() => null);
                }
            }

            // Sonuç mesajını 5 saniye sonra sil
            if (resMsg) setTimeout(() => resMsg.delete().catch(() => { }), 5000);

            // --- MAP VETO IMAGE GENERATION ---
            try {
                const canvasGenerator = require('../../utils/canvasGenerator');
                const mapStates = {};
                // MAPS zaten import edilmiş durumda
                MAPS.forEach(m => {
                    const isSelected = m.name === match.selectedMap;
                    mapStates[m.name] = {
                        banned: !isSelected,
                        bannedBy: isSelected ? null : 'ELENEN'
                    };
                });

                const buffer = await canvasGenerator.createMapVetoImage(mapStates, match.selectedMap, 'OYLAMA SONUCU');
                const attachment = new AttachmentBuilder(buffer, { name: 'map-veto.png' });

                // Görseli gönder
                const vetoMsg = await channel.send({ content: `✅ **Harita:** ${match.selectedMap}`, files: [attachment] });

                // Görselin görünmesi için biraz bekle (Match Start başlamadan önce)
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.error('Map Veto Image Gen Error:', e);
            }

            // "KADROLAR BELİRLENDİ" Embed'ine Haritayı Ekle
            try {
                if (match.draftMessageId) {
                    const draftMsg = await channel.messages.fetch(match.draftMessageId).catch(() => null);
                    if (draftMsg) {
                        const oldEmbed = draftMsg.embeds[0];
                        if (oldEmbed) {
                            const newEmbed = EmbedBuilder.from(oldEmbed);
                            // Açıklamanın sonuna haritayı ekle
                            newEmbed.setDescription(oldEmbed.description + `\n\n<a:tik:1242549144887754853> **Harita:** ${match.selectedMap}`);
                            await draftMsg.edit({ embeds: [newEmbed] });
                        }
                    }
                }
            } catch (e) { }

            await match.save();

            // Game Handler'a geç (Yazı Tura)
            await gameHandler.prepareMatchStart(channel, match);
        } catch (error) {
            // Hata olursa (Kanal yoksa vb.) sessiz kal
            // console.error('EndVoting Error:', error);
        }
    }
};
