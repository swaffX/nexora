const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Seviye bilgilerini görüntüle')
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Kullanıcı (belirtilmezse kendiniz)')),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı') || interaction.user;
        const userData = await User.findOrCreate(user.id, interaction.guild.id, user.username);

        const nextLevelXP = Math.pow((userData.level + 1) / 0.1, 2);
        const currentLevelXP = Math.pow(userData.level / 0.1, 2);
        const progress = userData.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;
        const percentage = Math.round((progress / needed) * 100);

        const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));

        // Sıralama bul
        const rankPosition = await User.countDocuments({
            odaId: interaction.guild.id,
            xp: { $gt: userData.xp }
        }) + 1;

        await interaction.reply({
            embeds: [{
                color: 0x9B59B6,
                author: {
                    name: user.tag,
                    icon_url: user.displayAvatarURL({ dynamic: true })
                },
                fields: [
                    { name: '📊 Seviye', value: `**${userData.level}**`, inline: true },
                    { name: '✨ XP', value: `**${userData.xp.toLocaleString()}**`, inline: true },
                    { name: '🏆 Sıralama', value: `**#${rankPosition}**`, inline: true },
                    { name: '📝 Toplam Mesaj', value: `**${userData.totalMessages.toLocaleString()}**`, inline: true },
                    { name: '🎙️ Ses Süresi', value: `**${Math.floor(userData.totalVoiceMinutes / 60)}s ${userData.totalVoiceMinutes % 60}d**`, inline: true },
                    { name: 'İlerleme', value: `${progressBar} ${percentage}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP`, inline: false }
                ],
                timestamp: new Date()
            }]
        });
    }
};
