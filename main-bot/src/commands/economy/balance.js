const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Cüzdanındaki ve bankandaki parayı gösterir.')
        .addUserOption(option =>
            option.setName('user').setDescription('Başkasının bakiyesini gör (Opsiyonel)')),
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;

        const userData = await User.findOne({ odasi: target.id, odaId: interaction.guild.id });
        const balance = userData ? userData.balance : 0;
        const bank = userData ? userData.bank : 0;

        const embed = new EmbedBuilder()
            .setColor('#FFD700') // Gold
            .setAuthor({ name: `${target.username} Bakiyesi`, iconURL: target.displayAvatarURL() })
            .addFields(
                { name: '💵 Cüzdan', value: `${balance.toLocaleString()} NexCoin`, inline: true },
                { name: '💳 Banka', value: `${bank.toLocaleString()} NexCoin`, inline: true },
                { name: '💰 Toplam', value: `${(balance + bank).toLocaleString()} NexCoin`, inline: true }
            )
            .setFooter({ text: 'Nexora Economy' });

        await interaction.reply({ embeds: [embed] });
    }
};
