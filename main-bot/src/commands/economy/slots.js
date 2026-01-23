const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Slot makinesini çevir! 🍒 7️⃣ 💎')
        .addIntegerOption(option =>
            option.setName('amount').setDescription('Bahis miktarı').setRequired(true).setMinValue(50)),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        let user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user || user.balance < amount) {
            return interaction.reply({ content: '❌ Yetersiz bakiye!', ephemeral: true });
        }

        user.balance -= amount;

        const items = ['🍒', '🍋', '🍇', '🍉', '7️⃣', '💎', '🔔'];

        // 3 tane rastgele seç
        const r1 = items[Math.floor(Math.random() * items.length)];
        const r2 = items[Math.floor(Math.random() * items.length)];
        const r3 = items[Math.floor(Math.random() * items.length)];

        let winnings = 0;
        let resultMsg = 'Kaybettin.';

        // Kazanma Kombinasyonları
        if (r1 === r2 && r2 === r3) {
            // Jackpot (3'ü aynı)
            if (r1 === '💎') winnings = amount * 50;
            else if (r1 === '7️⃣') winnings = amount * 20;
            else winnings = amount * 10;
            resultMsg = 'JACKPOT! 🎰';
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            // 2'si aynı (Teselli)
            winnings = Math.floor(amount * 1.5);
            resultMsg = 'Güzel deneme!';
        }

        if (winnings > 0) {
            user.balance += winnings;
        }

        await user.save();

        const embed = new EmbedBuilder()
            .setColor(winnings > 0 ? '#f1c40f' : '#2F3136')
            .setTitle('🎰 Slot Makinesi')
            .setDescription(`**[ ${r1} | ${r2} | ${r3} ]**\n\n${winnings > 0 ? `🎉 **KAZANDIN:** ${winnings} NexCoin!` : '❌ Kaybettin.'}`)
            .setFooter({ text: `Yeni Bakiye: ${user.balance}` });

        await interaction.reply({ embeds: [embed] });
    }
};
