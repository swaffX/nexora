const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS, getCategoryId } = require('./constants');
const manager = require('./manager');

module.exports = {
    async startSideSelection(channel, match) {
        const winner = Math.random() < 0.5 ? 'A' : 'B';
        match.coinFlipWinner = winner;
        match.status = 'SIDE_SELECTION';
        await match.save();

        const winnerId = winner === 'A' ? match.captainA : match.captainB;
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🏰 Harita: ${match.selectedMap}`)
            .setDescription(`**Taraf Seçimi:** Team ${winner} (<@${winnerId}>)`)
            .setImage(mapData ? mapData.img : null);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_ATTACK`).setLabel('🗡️ Attack').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_DEFEND`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Success)
        );

        await channel.send({ content: `<@${winnerId}>`, embeds: [embed], components: [row] });
    },

    async handleSidePick(interaction) {
        const [_, __, matchId, side] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const winnerId = match.coinFlipWinner === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== winnerId) return interaction.reply({ content: 'Sıra sende değil!', ephemeral: true });

        if (match.coinFlipWinner === 'A') {
            match.sideA = side;
            match.sideB = side === 'ATTACK' ? 'DEFEND' : 'ATTACK';
        } else {
            match.sideB = side;
            match.sideA = side === 'ATTACK' ? 'DEFEND' : 'ATTACK';
        }

        match.status = 'LIVE';
        await match.save();

        await interaction.update({ components: [] });
        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async setupVoiceAndStart(guild, match, infoChannel) {
        const MATCH_CATEGORY_ID = getCategoryId();
        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;

        const createPerms = (teamIds) => [
            { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))
        ];

        const voiceA = await guild.channels.create({ name: `🔵 Team A (${match.sideA})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
        const voiceB = await guild.channels.create({ name: `🔴 Team B (${match.sideB})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

        match.createdChannelIds.push(voiceA.id);
        match.createdChannelIds.push(voiceB.id);
        await match.save();

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        const panelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger));
        await infoChannel.send({ content: `✅ **MAÇ BAŞLADI!**`, components: [panelRow] });
    },

    async endMatch(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_A`).setLabel('🏆 Team A').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_B`).setLabel('🏆 Team B').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_CANCEL`).setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: '🏁 Maç Sonucu?', components: [row], ephemeral: true });
    },

    async handleMatchResult(interaction) {
        const [_, __, matchId, winner] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });
        if (!match) return;
        await interaction.update({ content: '⏳ İşleniyor...', components: [] });

        if (winner !== 'CANCEL') {
            const betReport = await this.processBets(interaction.guild, match, winner);
            await this.generateResultCard(interaction.guild, match, winner, betReport);
            await manager.cleanupMatchChannels(interaction.guild, match);
        } else {
            // İptal (Force End gibi)
            await manager.forceEndMatch(interaction.guild, match.matchId, 'Maç sonucu girilirken iptal edildi.');
            await interaction.followUp({ content: '✅ Maç iptal edildi ve kanallar silindi.', ephemeral: true });
        }
    },

    async generateResultCard(guild, match, winnerTeam, betReport = null) {
        try {
            let resultChannel = guild.channels.cache.find(c => c.name === 'maç-sonuçları');
            if (!resultChannel) resultChannel = await guild.channels.create({ name: 'maç-sonuçları', type: ChannelType.GuildText });
            const winningTeamIds = winnerTeam === 'A' ? match.teamA : match.teamB;
            const teamName = winnerTeam === 'A' ? 'TEAM A' : 'TEAM B';
            const color = winnerTeam === 'A' ? '#5865F2' : '#ED4245';

            const canvas = createCanvas(800, 450); const ctx = canvas.getContext('2d');
            const mapData = MAPS.find(m => m.name === match.selectedMap) || MAPS[0];
            try {
                const bg = await loadImage(mapData.img); ctx.drawImage(bg, 0, 0, 800, 450);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, 800, 450);
            } catch (e) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 800, 450); }

            ctx.textAlign = 'center'; ctx.font = '80px VALORANT'; ctx.fillStyle = color; ctx.fillText('VICTORY', 400, 100);
            ctx.font = '40px VALORANT'; ctx.fillStyle = 'white'; ctx.fillText(`${teamName} WON`, 400, 150);
            for (let i = 0; i < winningTeamIds.length; i++) {
                try {
                    const member = await guild.members.fetch(winningTeamIds[i]);
                    const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }));
                    const x = 100 + (i * 130); const y = 220;
                    ctx.save(); ctx.beginPath(); ctx.arc(x + 50, y + 50, 50, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, x, y, 100, 100); ctx.restore();
                    ctx.fillStyle = 'white'; ctx.font = '18px VALORANT'; ctx.fillText(member.displayName.substring(0, 10), x + 50, y + 130);
                } catch (e) { }
            }
            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'match-result.png' });
            const embed = new EmbedBuilder().setColor(color).setImage('attachment://match-result.png').setDescription(`**Kazanan:** ${teamName}\n**Harita:** ${match.selectedMap}`);
            if (betReport) embed.addFields({ name: 'Bahis', value: betReport });
            await resultChannel.send({ embeds: [embed], files: [attachment] });
        } catch (e) { console.error(e); }
    },

    async processBets(guild, match, winnerTeam) {
        if (!match.bets) return null;
        let winners = [];
        for (const bet of match.bets) {
            if (bet.team === winnerTeam && !bet.claimed) {
                const winAmount = bet.amount * 2;
                const user = await User.findOne({ odasi: bet.userId, odaId: guild.id });
                if (user) { user.balance += winAmount; await user.save(); winners.push(`<@${bet.userId}> (+${winAmount})`); bet.claimed = true; }
            }
        }
        await match.save();
        return winners.length ? `💰 **Kazananlar:** ${winners.join(', ')}` : null;
    }
};
