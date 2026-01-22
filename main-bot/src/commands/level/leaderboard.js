const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Liderlik tablosunu görüntüle')
        .addStringOption(opt =>
            opt.setName('tür')
                .setDescription('Liderlik tablosu türü')
                .setRequired(true)
                .addChoices(
                    { name: 'XP / Seviye', value: 'xp' },
                    { name: 'Mesaj', value: 'messages' },
                    { name: 'Ses', value: 'voice' }
                ))
        .addStringOption(opt =>
            opt.setName('dönem')
                .setDescription('Zaman dilimi')
                .addChoices(
                    { name: 'Günlük', value: 'daily' },
                    { name: 'Haftalık', value: 'weekly' },
                    { name: 'Aylık', value: 'monthly' },
                    { name: 'Tüm Zamanlar', value: 'all' }
                )),

    async execute(interaction) {
        const type = interaction.options.getString('tür');
        const period = interaction.options.getString('dönem') || 'all';

        await interaction.deferReply();

        // Field mapping
        const fieldMap = {
            'xp': { all: 'xp', daily: 'xp', weekly: 'xp', monthly: 'xp' },
            'messages': { all: 'totalMessages', daily: 'dailyMessages', weekly: 'weeklyMessages', monthly: 'monthlyMessages' },
            'voice': { all: 'totalVoiceMinutes', daily: 'dailyVoice', weekly: 'weeklyVoice', monthly: 'monthlyVoice' }
        };

        const sortField = fieldMap[type][period];

        const users = await User.find({ odaId: interaction.guild.id })
            .sort({ [sortField]: -1 })
            .limit(10);

        const medals = ['🥇', '🥈', '🥉'];
        let description = '';

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const medal = i < 3 ? medals[i] : `**${i + 1}.**`;

            let value;
            if (type === 'voice') {
                const minutes = user[sortField] || 0;
                value = `${Math.floor(minutes / 60)}s ${minutes % 60}d`;
            } else if (type === 'xp') {
                value = `Level ${user.level} (${user.xp.toLocaleString()} XP)`;
            } else {
                value = (user[sortField] || 0).toLocaleString();
            }

            description += `${medal} <@${user.odasi}> - ${value}\n`;
        }

        const titles = {
            'xp': 'XP / Seviye',
            'messages': 'Mesaj',
            'voice': 'Ses Süresi'
        };

        const periods = {
            'all': 'Tüm Zamanlar',
            'daily': 'Günlük',
            'weekly': 'Haftalık',
            'monthly': 'Aylık'
        };

        await interaction.editReply({
            embeds: [{
                color: 0x9B59B6,
                title: `🏆 ${titles[type]} Liderlik Tablosu`,
                description: description || 'Henüz veri yok.',
                footer: { text: periods[period] },
                timestamp: new Date()
            }]
        });
    }
};
