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

        const sender = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!sender || sender.balance < amount) {
            return interaction.reply({ content: '❌ Yetersiz bakiye.', ephemeral: true });
        }

        // Gönderenden düş
        sender.balance -= amount;
        await sender.save();

        // Alıcıya ekle
        let receiver = await User.findOne({ odasi: target.id, odaId: interaction.guild.id });
        if (!receiver) {
            receiver = await User.create({ odasi: target.id, odaId: interaction.guild.id, username: target.username });
        }
        receiver.balance += amount;
        await receiver.save();

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setDescription(`✅ **Transfer Başarılı!**\n\n📤 Gönderen: ${interaction.user}\n📥 Alıcı: ${target}\n💰 Tutar: **${amount} NexCoin**`);

        await interaction.reply({ embeds: [embed] });
    }
};
