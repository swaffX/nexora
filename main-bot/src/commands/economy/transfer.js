const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Başka bir oyuncuya para gönder.')
        .addUserOption(option => option.setName('user').setDescription('Alıcı').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Miktar').setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (target.id === interaction.user.id) return interaction.reply({ content: 'Kendine para atamazsın.', ephemeral: true });
        if (target.bot) return interaction.reply({ content: 'Botlara para atamazsın.', ephemeral: true });

        // ATOMİK İŞLEM: Gönderenden düş
        const sender = await User.findOneAndUpdate(
            { odasi: interaction.user.id, odaId: interaction.guild.id, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!sender) {
            return interaction.reply({ content: '❌ Yetersiz bakiye veya hesap bulunamadı.', ephemeral: true });
        }

        // ATOMİK İŞLEM: Alıcıya ekle
        // Alıcı DB'de yoksa findQrUpdate (upsert: true) kullanılabilir ancak model yapımızda findOrCreate mantığı var.
        // Basitlik için upsert: true kullanacağız.
        await User.findOneAndUpdate(
            { odasi: target.id, odaId: interaction.guild.id },
            { $inc: { balance: amount }, $setOnInsert: { username: target.username } }, // Username'i sadece yeni oluşursa yaz
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setDescription(`✅ **Transfer Başarılı!**\n\n📤 Gönderen: ${interaction.user}\n📥 Alıcı: ${target}\n💰 Tutar: **${amount} NexCoin**`);

        await interaction.reply({ embeds: [embed] });
    }
};
