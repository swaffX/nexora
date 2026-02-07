const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('titles')
        .setDescription('Kazandığınız title\'ları yönetin ve tüm listeyi görün.'),

    async execute(interaction) {
        // Yeni standart: MessageFlags.Ephemeral
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const guildId = interaction.guild.id;
        const userDoc = await User.findOne({ odasi: interaction.user.id, odaId: guildId });

        // User stats'ı tazele (Title'ları kontrol et)
        if (userDoc) {
            eloService.ensureValidStats(userDoc);
            await userDoc.save();
        }

        const myTitles = userDoc?.matchStats?.titles || [];
        const currentTitle = userDoc?.matchStats?.activeTitle || 'Yok';

        // Rehber Görseli Oluştur
        const buffer = await canvasGenerator.createTitlesGuideImage();
        const attachment = new AttachmentBuilder(buffer, { name: 'titles-guide.png' });

        const embed = new EmbedBuilder()
            .setTitle('🏆 Nexora Title Sistemi')
            .setDescription(`Aşağıdaki listeden kazandığınız title'lar arasından seçim yapabilirsiniz. Maç oynadıkça ve başarı kazandıkça yeni title'lar otomatik olarak listenize eklenecektir.\n\n**Senin Aktif Title'ın:** \`${currentTitle}\``)
            .setImage('attachment://titles-guide.png')
            .setColor('#fbbf24');

        const components = [];

        if (myTitles.length > 0) {
            const options = myTitles.map(t => ({
                label: t,
                value: t,
                description: eloService.ELO_CONFIG.TITLES[t]?.description || 'Nexora Title',
                default: t === currentTitle
            }));

            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_title')
                        .setPlaceholder('Kullanmak istediğiniz title\'ı seçin...')
                        .addOptions(options)
                )
            );
        } else {
            embed.setFooter({ text: 'Henüz hiç title kazanmamışsınız. Yukarıdaki tablodan görevlere bakabilirsiniz!' });
        }

        const response = await interaction.editReply({
            embeds: [embed],
            files: [attachment],
            components: components
        });

        if (components.length > 0) {
            const collector = response.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'select_title') {
                    const selected = i.values[0];
                    userDoc.matchStats.activeTitle = selected;
                    await userDoc.save();

                    await i.update({
                        content: `✅ Aktif title'ınız başarıyla **${selected}** olarak güncellendi!`,
                        embeds: [],
                        components: [],
                        files: []
                    });
                }
            });
        }
    }
};
