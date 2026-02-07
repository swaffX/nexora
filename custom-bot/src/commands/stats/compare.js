const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('İki oyuncunun istatistiklerini yan yana karşılaştırın.')
        .addUserOption(option =>
            option.setName('user1')
                .setDescription('İlk kullanıcı')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user2')
                .setDescription('İkinci kullanıcı')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const u1 = interaction.options.getUser('user1');
            const u2 = interaction.options.getUser('user2');
            const guildId = interaction.guild.id;

            const userDoc1 = await User.findOne({ odasi: u1.id, odaId: guildId });
            const userDoc2 = await User.findOne({ odasi: u2.id, odaId: guildId });

            const stats1 = userDoc1 ? userDoc1.matchStats : eloService.createDefaultStats();
            const stats2 = userDoc2 ? userDoc2.matchStats : eloService.createDefaultStats();

            const user1Data = {
                username: u1.username,
                avatar: u1.displayAvatarURL({ extension: 'png' })
            };
            const user2Data = {
                username: u2.username,
                avatar: u2.displayAvatarURL({ extension: 'png' })
            };

            const buffer = await canvasGenerator.createCompareImage(user1Data, stats1, user2Data, stats2);
            const attachment = new AttachmentBuilder(buffer, { name: 'compare.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Compare Komutu Hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        }
    }
};
