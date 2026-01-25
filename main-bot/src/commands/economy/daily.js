const { SlashCommandBuilder, EmbedBuilder , MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const DAILY_REWARD = 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Günlük para ödülünü topla.'),
    async execute(interaction) {
        let user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user) {
            user = await User.create({ odasi: interaction.user.id, odaId: interaction.guild.id, username: interaction.user.username });
        }

        const now = new Date();
        const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;

        // 24 Saat Kontrolü
        if (lastDaily && (now - lastDaily) < 86400000) {
            const diff = 86400000 - (now - lastDaily);
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            return interaction.reply({ content: `⏱️ Günlük ödülünü zaten aldın! **${hours} saat ${minutes} dakika** sonra tekrar gel.`, flags: MessageFlags.Ephemeral });
        }

        user.balance += DAILY_REWARD;
        user.lastDaily = now;
        user.lastDaily = now;
        await user.save();

        // Quest Update
        const { updateQuestProgress } = require('../../utils/questManager');
        await updateQuestProgress(user, 'daily', 1);

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(`🎉 **Günlük Ödül!** Hesabına **${DAILY_REWARD} NexCoin** eklendi.\nYeni Bakiye: **${user.balance}** 💵`);

        await interaction.reply({ embeds: [embed] });
    }
};
