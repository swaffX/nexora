const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, UserSelectMenuBuilder, ChannelType } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const draftHandler = require('./draft');
const { getCategoryId, setCategoryId } = require('./constants');

module.exports = {
    async createLobby(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        const REQUIRED_VOICE_ID = '1463922466467483801';

        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            const { MessageFlags } = require('discord.js');
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.member.voice.channelId !== REQUIRED_VOICE_ID) {
            const { MessageFlags } = require('discord.js');
            return interaction.reply({ content: `❌ <#${REQUIRED_VOICE_ID}> kanalında olmalısınız!`, flags: MessageFlags.Ephemeral });
        }

        let MATCH_CATEGORY_ID = getCategoryId();
        let category = interaction.guild.channels.cache.get(MATCH_CATEGORY_ID);
        if (!category) {
            category = await interaction.guild.channels.create({ name: '🏆 | ACTIVE MATCHES', type: ChannelType.GuildCategory });
            MATCH_CATEGORY_ID = category.id;
            setCategoryId(MATCH_CATEGORY_ID);
        }

        const matchId = interaction.id;
        const newMatch = new Match({
            matchId: matchId, guildId: interaction.guild.id, hostId: interaction.user.id,
            channelId: interaction.channel.id, lobbyVoiceId: interaction.member.voice.channelId, status: 'SETUP'
        });
        await newMatch.save();

        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('👑 Kaptan Seçimi').setDescription('Kaptanları belirleyin.')
            .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true });

        const rows = [
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainA').setPlaceholder('Team A Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainB').setPlaceholder('Team B Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_randomcap_${matchId}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary))
        ];

        await interaction.reply({ content: `Match ID: ${matchId}`, embeds: [embed], components: rows, ephemeral: false });
    },

    async selectCaptain(interaction, team) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.message.content.split('Match ID: ')[1];
        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: MessageFlags.Ephemeral });

        const selectedId = interaction.values[0];
        if (team === 'A') {
            if (match.captainB === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', flags: MessageFlags.Ephemeral });
            match.captainA = selectedId; match.teamA = [selectedId];
        } else {
            if (match.captainA === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', flags: MessageFlags.Ephemeral });
            match.captainB = selectedId; match.teamB = [selectedId];
        }
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async assignRandomCaptains(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: 'Ses kanalında değilsin!', flags: MessageFlags.Ephemeral });

        const members = voiceChannel.members.filter(m => !m.user.bot).map(m => m.id);
        if (members.length < 2) return interaction.reply({ content: 'En az 2 oyuncu lazım.', flags: MessageFlags.Ephemeral });

        const shuffled = members.sort(() => 0.5 - Math.random());
        match.captainA = shuffled[0]; match.teamA = [shuffled[0]];
        match.captainB = shuffled[1]; match.teamB = [shuffled[1]];
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async updateCaptainUI(interaction, match) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(0, 2,
            { name: '🔵 Team A Kaptanı', value: match.captainA ? `<@${match.captainA}>` : 'Seçilmedi', inline: true },
            { name: '🔴 Team B Kaptanı', value: match.captainB ? `<@${match.captainB}>` : 'Seçilmedi', inline: true }
        );

        if (match.captainA && match.captainB) {
            match.status = 'DRAFT';
            await match.save();
            await interaction.message.delete().catch(() => { });

            // Draft Modülüne Geç
            await draftHandler.startDraftMode(interaction, match);
        } else {
            await interaction.update({ embeds: [embed] });
        }
    }
};
