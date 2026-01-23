const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Yazı Tura at ve bahsi katla!')
        .addIntegerOption(option =>
            option.setName('amount').setDescription('Bahis miktarı').setRequired(true).setMinValue(10))
        .addStringOption(option =>
            option.setName('choice').setDescription('Yazı mı Tura mı?').setRequired(true)
                .addChoices({ name: 'Yazı', value: 'yazi' }, { name: 'Tura', value: 'tura' })),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const choice = interaction.options.getString('choice');

        let user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user || user.balance < amount) {
            return interaction.reply({ content: '❌ Yetersiz bakiye! Parana sahip çık.', ephemeral: true });
        }

        // Parayı düş
        user.balance -= amount;

        const result = Math.random() < 0.5 ? 'yazi' : 'tura';
        const win = result === choice;

        let embedColor = '#e74c3c'; // Red
        let description = `🪙 Para dönüyor... **${result.toUpperCase()}** geldi!\n😢 **Kaybettin.** -${amount} NexCoin`;

        if (win) {
            const winnings = amount * 2;
            user.balance += winnings;
            embedColor = '#2ecc71'; // Green
            description = `🪙 Para dönüyor... **${result.toUpperCase()}** geldi!\n🎉 **KAZANDIN!** +${winnings} NexCoin`;
        }

        await user.save();

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('Yazı Tura Bahsi')
            .setDescription(description)
            .setFooter({ text: `Yeni Bakiye: ${user.balance}` });

        await interaction.reply({ embeds: [embed] });
    }
};
