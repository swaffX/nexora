const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customize')
        .setDescription('Profil kartınızı (Title ve Arkaplan) kişiselleştirin.'),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const guildId = interaction.guild.id;
        const userDoc = await User.findOne({ odasi: interaction.user.id, odaId: guildId });

        if (!userDoc) {
            return interaction.editReply({ content: '❌ Kaydınız bulunamadı.' });
        }

        const stats = userDoc.matchStats || {};
        const myTitles = stats.titles || ['Rookie'];
        const currentTitle = stats.activeTitle || 'Rookie';
        const currentBg = userDoc.backgroundImage || 'Default';

        const embed = new EmbedBuilder()
            .setTitle('🎨 Profil Kişiselleştirme')
            .setDescription('Buradan ELO ve Stats kartlarınızın görünümünü değiştirebilirsiniz.')
            .addFields(
                { name: '📍 Aktif Ünvan', value: `\`${currentTitle}\``, inline: true },
                { name: '🖼️ Arkaplan Teması', value: `\`${currentBg}\``, inline: true }
            )
            .setColor('#fbbf24')
            .setFooter({ text: 'Değişiklik yapmak için aşağıdaki menüleri kullanın.' });

        // Title Seçim Menüsü
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

        // Arkaplan Seçim Menüsü
        const bgOptions = Object.keys(eloService.ELO_CONFIG.BACKGROUND_THEMES).map(bg => ({
            label: bg,
            value: `bg_${bg}`,
            description: `${bg} temalı arkaplan.`,
            emoji: '🖼️',
            default: bg === currentBg
        }));

        const bgRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_bg')
                .setPlaceholder('Arkaplan teması seçin...')
                .addOptions(bgOptions)
        );

        const response = await interaction.editReply({
            embeds: [embed],
            components: [titleRow, bgRow]
        });

        const collector = response.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.customId === 'select_title') {
                const selected = i.values[0].replace('title_', '');
                userDoc.matchStats.activeTitle = selected;
                await userDoc.save();

                // Embed'i güncelle
                embed.setFields(
                    { name: '📍 Aktif Ünvan', value: `\`${selected}\``, inline: true },
                    { name: '🖼️ Arkaplan Teması', value: `\`${userDoc.backgroundImage || 'Default'}\``, inline: true }
                );

                await i.update({ embeds: [embed] });
            }
            else if (i.customId === 'select_bg') {
                const selected = i.values[0].replace('bg_', '');
                userDoc.backgroundImage = selected;
                await userDoc.save();

                // Embed'i güncelle
                embed.setFields(
                    { name: '📍 Aktif Ünvan', value: `\`${userDoc.matchStats.activeTitle || 'Rookie'}\``, inline: true },
                    { name: '🖼️ Arkaplan Teması', value: `\`${selected}\``, inline: true }
                );

                await i.update({ embeds: [embed] });
            }
        });
    }
};
