const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge') // Türkçe 'temizle' yerine global 'purge' kullanımı daha standart
        .setDescription('Toplu mesaj sil')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(opt =>
            opt.setName('sayı')
                .setDescription('Silinecek mesaj sayısı (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Sadece bu kullanıcının mesajlarını sil')),

    async execute(interaction) {
        const amount = interaction.options.getInteger('sayı');
        const user = interaction.options.getUser('kullanıcı');

        await interaction.deferReply({ ephemeral: true });

        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });

            if (user) {
                messages = messages.filter(m => m.author.id === user.id);
            }

            messages = Array.from(messages.values()).slice(0, amount);

            // 14 günden eski mesajları filtrele
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

            if (messages.length === 0) {
                return interaction.editReply({
                    embeds: [embeds.warning('Uyarı', 'Silinecek mesaj bulunamadı.')]
                });
            }

            const deleted = await interaction.channel.bulkDelete(messages, true);

            await interaction.editReply({
                embeds: [embeds.success('Mesajlar Silindi', `**${deleted.size}** mesaj silindi.${user ? ` (${user.tag})` : ''}`)]
            });

        } catch (error) {
            await interaction.editReply({
                embeds: [embeds.error('Hata', `Silme başarısız: ${error.message}`)]
            });
        }
    }
};
