const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, AttachmentBuilder
} = require('discord.js');
const path = require('path');

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

        const { MessageFlags } = require('discord.js');
        if (interaction.user.id !== match.captainA) return interaction.reply({ content: 'Sadece Team A Kaptanı seçebilir.', flags: MessageFlags.Ephemeral });

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

        const { MessageFlags } = require('discord.js');
        const winnerId = match.coinFlipWinner === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== winnerId) return interaction.reply({ content: 'Sıra sende değil!', flags: MessageFlags.Ephemeral });

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

        const panelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger));

        const payload = {
            content: `✅ **MAÇ BAŞLADI!**\n🏰 Harita: **${match.selectedMap}**\n⚔️ Taraf: **${nameA} (${match.sideA}) vs ${nameB} (${match.sideB})**`,
            components: [panelRow]
        };

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

        if (winner === 'CANCEL') {
            await interaction.update({ content: '⏳ İptal ediliyor...', components: [] });
            await manager.forceEndMatch(interaction.guild, match.matchId, 'Maç sonucu girilirken iptal edildi.');
            const { MessageFlags } = require('discord.js');
            await interaction.followUp({ content: '✅ Maç iptal edildi ve kanallar silindi.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Kazananı kaydet
        match.winnerTeam = winner;
        match.status = 'FINISHED';
        await match.save();

        await interaction.update({ content: '⏳ İşleniyor...', components: [] });

        // Bahisleri işle
        const betReport = await this.processBets(interaction.guild, match, winner);

        // Skor Giriş Modal'ını Göster
        await this.showScoreModal(interaction, match, betReport);
    },

    // Skor Giriş Modal'ı
    async showScoreModal(interaction, match, betReport) {
        // betReport'u kaydet
        match.betReport = betReport;
        await match.save();

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${match.matchId}`)
            .setTitle('📊 Maç Skoru Girişi');

        const scoreAInput = new TextInputBuilder()
            .setCustomId('scoreA')
            .setLabel('Team A Skoru')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 13')
            .setRequired(true);

        const scoreBInput = new TextInputBuilder()
            .setCustomId('scoreB')
            .setLabel('Team B Skoru')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 11')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(scoreAInput),
            new ActionRowBuilder().addComponents(scoreBInput)
        );

        // Modal'ı ayrı bir mesajla tetikle
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`match_openscore_${match.matchId}`)
                .setLabel('📝 Skor Gir')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({
            content: `🏆 **Kazanan: Team ${match.winnerTeam}**\n\nLütfen maç skorunu girmek için butona tıklayın.`,
            components: [row]
        });
    },

    // Skor Modal Aç Butonu
    async openScoreModal(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${match.matchId}`)
            .setTitle('📊 Maç Skoru Girişi');

        const scoreAInput = new TextInputBuilder()
            .setCustomId('scoreA')
            .setLabel('Team A Skoru (Round)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 13')
            .setRequired(true);

        const scoreBInput = new TextInputBuilder()
            .setCustomId('scoreB')
            .setLabel('Team B Skoru (Round)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 11')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(scoreAInput),
            new ActionRowBuilder().addComponents(scoreBInput)
        );

        await interaction.showModal(modal);
    },

    // Skor Modal Submit
    async handleScoreSubmit(interaction) {
        const matchId = interaction.customId.split('_')[2];

        const scoreA = parseInt(interaction.fields.getTextInputValue('scoreA')) || 0;
        const scoreB = parseInt(interaction.fields.getTextInputValue('scoreB')) || 0;

        const match = await Match.findOne({ matchId });
        if (!match) return;

        // Skorları kaydet
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        await match.save();

        await interaction.update({ content: '⏳ Maç sonucu oluşturuluyor...', components: [] });

        // Sonuç kartını oluştur
        await this.generateResultCard(interaction.guild, match, match.winnerTeam, match.betReport);

        // Cleanup
        await manager.cleanupMatchChannels(interaction.guild, match);
    },

    async generateResultCard(guild, match, winnerTeam, betReport = null) {
        try {
            let resultChannel = guild.channels.cache.find(c => c.name === 'maç-sonuçları');
            if (!resultChannel) resultChannel = await guild.channels.create({ name: 'maç-sonuçları', type: ChannelType.GuildText });

            const teamName = winnerTeam === 'A' ? 'TEAM A 🔵' : 'TEAM B 🔴';
            const color = winnerTeam === 'A' ? 0x5865F2 : 0xED4245;

            // Skor gösterimi (13-11 gibi)
            const scoreDisplay = `**${match.scoreA || 0}** - **${match.scoreB || 0}**`;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: '🎮 MAÇ SONUCU' })
                .setTitle(`🏆 KAZANAN: ${teamName}`)
                .setDescription(`**🗺️ Harita:** ${match.selectedMap}\n**📊 Skor:** ${scoreDisplay}\n**📅 Tarih:** <t:${Math.floor(Date.now() / 1000)}:f>`)
                .addFields(
                    {
                        name: '🔵 TEAM A',
                        value: match.teamA.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok',
                        inline: true
                    },
                    {
                        name: '🔴 TEAM B',
                        value: match.teamB.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok',
                        inline: true
                    }
                )
                .setTimestamp();

            if (betReport) embed.addFields({ name: '💰 Bahis Sonuçları', value: betReport, inline: false });

            await resultChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Result Card Error:', e); }
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
