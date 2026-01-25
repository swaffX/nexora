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
        // Coinflip Aşamasını Başlat
        match.status = 'COIN_FLIP';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🪙 Yazı Tura (Coinflip)')
            .setDescription(`**Team A Kaptanı** (<@${match.captainA}>), seçimini yap!\nKazanan taraf seçme hakkını elde eder.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_coin_HEADS_${match.matchId}`).setLabel('Yazı').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
            new ButtonBuilder().setCustomId(`match_coin_TAILS_${match.matchId}`).setLabel('Tura').setStyle(ButtonStyle.Secondary).setEmoji('🦅')
        );

        await channel.send({ content: `<@${match.captainA}>`, embeds: [embed], components: [row] });
    },

    async handleCoinFlip(interaction) {
        const [_, __, choice, matchId] = interaction.customId.split('_'); // match_coin_HEADS_123
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (interaction.user.id !== match.captainA) return interaction.reply({ content: 'Sadece Team A Kaptanı seçebilir.', ephemeral: true });

        await interaction.deferUpdate();

        // Sonucu Belirle
        const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
        const win = (choice === result);

        // Kazanan Kim?
        // Eğer A bildiyse -> A kazanır.
        // Bilemediyse -> B kazanır.
        const winnerTeam = win ? 'A' : 'B';
        match.coinFlipWinner = winnerTeam;
        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;

        // Animasyonlu Mesaj (3 saniye gecikmeli gibi yapabiliriz ama Discord API izin vermez, direkt sonucu atalım)
        const resultEmbed = new EmbedBuilder()
            .setColor(win ? 0x00FF00 : 0xFF0000)
            .setTitle(`🪙 Sonuç: ${result === 'HEADS' ? 'YAZI' : 'TURA'}!`)
            .setDescription(`**${choice === 'HEADS' ? 'Yazı' : 'Tura'}** seçildi.\n\n🎉 **Kazanan:** Team ${winnerTeam} (<@${winnerId}>)\nTaraf seçme hakkı kazandınız!`);

        await interaction.editReply({ components: [] });
        await interaction.channel.send({ embeds: [resultEmbed] });

        // Taraf Seçimine Geç
        setTimeout(() => this.showSidePicker(interaction.channel, match, winnerTeam), 2000);
    },

    async showSidePicker(channel, match, winnerTeam) {
        match.status = 'SIDE_SELECTION';
        await match.save();

        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🏰 Harita: ${match.selectedMap}`)
            .setDescription(`**Taraf Seçimi:** Team ${winnerTeam} (<@${winnerId}>)\nLütfen başlamak istediğiniz tarafı seçin.`)
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

        const captainA = await guild.members.fetch(match.captainA).catch(() => ({ displayName: 'PLAYER A' }));
        const captainB = await guild.members.fetch(match.captainB).catch(() => ({ displayName: 'PLAYER B' }));

        const nameA = `TEAM ${captainA.displayName.toUpperCase()}`;
        const nameB = `TEAM ${captainB.displayName.toUpperCase()}`;

        const voiceA = await guild.channels.create({ name: `🔵 ${nameA} (${match.sideA})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
        const voiceB = await guild.channels.create({ name: `🔴 ${nameB} (${match.sideB})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

        match.createdChannelIds.push(voiceA.id);
        match.createdChannelIds.push(voiceB.id);
        await match.save();

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        // --- MATCH START CANVAS ---
        const { createLobbyImage } = require('../../utils/matchCanvas');
        let attachment;
        try {
            const getMemberData = async (id) => {
                try {
                    const m = await guild.members.fetch(id);
                    return { username: m.displayName, avatarURL: m.user.displayAvatarURL({ extension: 'png', forceStatic: true }) };
                } catch { return { username: 'Unknown', avatarURL: null }; }
            };

            const teamAData = await Promise.all(match.teamA.map(getMemberData));
            const teamBData = await Promise.all(match.teamB.map(getMemberData));

            const buffer = await createLobbyImage(teamAData, teamBData, match.selectedMap || 'Abyss', nameA, nameB);
            attachment = new AttachmentBuilder(buffer, { name: 'match-start.png' });
        } catch (e) { console.error('Canvas Start Error:', e); }

        const panelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger));

        const payload = {
            content: `✅ **MAÇ BAŞLADI!**\n🏰 Harita: **${match.selectedMap}**\n⚔️ Taraf: **${nameA} (${match.sideA}) vs ${nameB} (${match.sideB})**`,
            components: [panelRow]
        };
        if (attachment) payload.files = [attachment];

        await infoChannel.send(payload);
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
        const { MessageFlags } = require('discord.js');
        await interaction.reply({ content: '🏁 Maç Sonucu?', components: [row], flags: MessageFlags.Ephemeral });
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
