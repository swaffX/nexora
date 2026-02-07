const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('titles')
        .setDescription('Kazandığınız title\'ları yönetin ve aktif olanı seçin.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const userDoc = await User.findOne({ odasi: interaction.user.id, odaId: guildId });

        if (!userDoc || !userDoc.matchStats || !userDoc.matchStats.titles || userDoc.matchStats.titles.length === 0) {
            return interaction.editReply({ content: '❌ **Henüz hiç title kazanmamışsınız.** Maç oynayarak ve başarılar elde ederek title kazanabilirsiniz!' });
        }

        const stats = userDoc.matchStats;
        const currentTitle = stats.activeTitle || 'Yok';

        const embed = new EmbedBuilder()
            .setTitle('🏆 Title Yönetimi')
            .setDescription(`Aşağıdaki listeden kazandığınız title'lar arasından seçim yapabilirsiniz.\n\n**Şu anki Title:** \`${currentTitle}\``)
            .setColor('#fbbf24')
            .addFields(
                { name: 'Nasıl Kazanılır?', value: '• **MVP Master:** 5 Kez MVP ol.\n• **Veteran:** 10 Maç oyna.\n• **On Fire:** 5 Galibiyet Serisi yakala.\n• **Unlucky:** 5 Mağlubiyet Serisi (Teselli).' }
            );

        const options = stats.titles.map(t => ({
            label: t,
            value: t,
            description: eloService.ELO_CONFIG.TITLES[t]?.description || 'Nexora Title',
            default: t === currentTitle
        }));

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_title')
                    .setPlaceholder('Aktif title seçin...')
                    .addOptions(options)
            );

        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'select_title') {
                const selected = i.values[0];
                userDoc.matchStats.activeTitle = selected;
                await userDoc.save();

                await i.update({
                    content: `✅ Aktif title'ınız başarıyla **${selected}** olarak güncellendi!`,
                    embeds: [],
                    components: []
                });
            }
        });
    }
};
