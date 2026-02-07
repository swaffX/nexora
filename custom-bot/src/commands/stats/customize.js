const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customize')
        .setDescription('Profil kartınızı (Title, Harita ve Ajan) kişiselleştirin.'),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const guildId = interaction.guild.id;
        let userDoc = await User.findOne({ odasi: interaction.user.id, odaId: guildId });

        if (!userDoc) {
            return interaction.editReply({ content: '❌ Kaydınız bulunamadı.' });
        }

        const getUI = () => {
            const stats = userDoc.matchStats || {};
            const myTitles = stats.titles || ['Rookie'];
            const currentTitle = stats.activeTitle || 'Rookie';
            const currentBg = userDoc.backgroundImage || 'Default';

            const embed = new EmbedBuilder()
                .setTitle('🎨 Profil Kişiselleştirme')
                .setDescription('Profil kartlarınızda (ELO/Stats) görünecek tercihlerinizi ayarlayın.')
                .addFields(
                    { name: '🏆 Ünvan', value: `\`${currentTitle}\``, inline: true },
                    { name: '🖼️ Arkaplan', value: `\`${currentBg}\``, inline: true }
                )
                .setColor('#fbbf24')
                .setFooter({ text: 'Değişiklik yapmak için aşağıdaki menüleri kullanın.' });

            // 1. Ünvan Menüsü
            const titleOptions = myTitles.map(t => ({
                label: t,
                value: `title_${t}`,
                description: eloService.ELO_CONFIG.TITLES[t]?.description || 'Nexora Title',
                emoji: '🏆',
                default: t === currentTitle
            }));
            const titleRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_title')
                    .setPlaceholder('Ünvan seçin...')
                    .addOptions(titleOptions)
            );

            // 2. Arkaplan Menüsü
            const bgOptions = Object.keys(eloService.ELO_CONFIG.BACKGROUND_THEMES).slice(0, 25).map(bg => ({
                label: bg,
                value: `bg_${bg}`,
                description: `${bg} temalı arkaplan.`,
                emoji: '🖼️',
                default: bg === currentBg
            }));
            const bgRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_bg')
                    .setPlaceholder('Kart arkaplanı seçin...')
                    .addOptions(bgOptions)
            );

            return { embeds: [embed], components: [titleRow, bgRow] };
        };

        const response = await interaction.editReply(getUI());
        const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 dk

        collector.on('collect', async i => {
            if (i.customId === 'select_title') {
                const selected = i.values[0].replace('title_', '');
                userDoc.matchStats.activeTitle = selected;
                await userDoc.save();
                await i.update(getUI());
            }
            else if (i.customId === 'select_bg') {
                const selected = i.values[0].replace('bg_', '');
                userDoc.backgroundImage = selected;
                await userDoc.save();
                await i.update(getUI());
            }
        });
    }
};
