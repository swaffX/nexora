const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bakiye')
        .setDescription('Cüzdanındaki ve bankandaki parayı görüntüle.')
        .addUserOption(option =>
            option.setName('kullanici').setDescription('Başkasının bakiyesini gör (Opsiyonel)')),
    async execute(interaction) {
        const target = interaction.options.getUser('kullanici') || interaction.user;

        const userData = await User.findOne({ odasi: target.id, odaId: interaction.guild.id });
        const balance = userData ? userData.balance : 0;
        const bank = userData ? userData.bank : 0;

        const embed = new EmbedBuilder()
            .setColor('#f1c40f') // Modern Gold
            .setAuthor({ name: `${target.username} • Cüzdan Durumu`, iconURL: target.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '<a:coin:1464519726708560079> Cüzdan', value: `**${balance.toLocaleString()}** NexCoin`, inline: true },
                { name: '💳 Banka', value: `**${bank.toLocaleString()}** NexCoin`, inline: true },
                { name: '💰 Toplam Varlık', value: `**${(balance + bank).toLocaleString()}** NexCoin`, inline: true }
            )
            .setFooter({ text: `Nexora Economy • ${new Date().toLocaleDateString('tr-TR')}`, iconURL: interaction.guild.iconURL() });

        await interaction.reply({ embeds: [embed] });
    }
};
