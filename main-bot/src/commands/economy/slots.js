const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Slot makinesini çevir')
        .addIntegerOption(opt =>
            opt.setName('bahis')
                .setDescription('Bahis miktarı')
                .setMinValue(10)
                .setMaxValue(50000)
                .setRequired(true)),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bahis');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 1. Bakiye Kontrol ve Düşüm (Atomik)
        const userData = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: bet } },
            { $inc: { balance: -bet } },
            { new: true }
        );

        if (!userData) {
            const current = await User.findOne({ odasi: userId, odaId: guildId });
            return interaction.reply({
                embeds: [embeds.error('Yetersiz Bakiye', `Bu bahis için **${(bet - (current?.balance || 0)).toLocaleString()} NexCoin** eksiğiniz var.`)]
            });
        }

        // Slot emojileri
        const slots = ['🍒', '🍋', '🍇', '🍉', '🍓', '💎', '7️⃣'];

        // Animasyon efekti için dönen slotlar
        const spinMsg = await interaction.reply({
            content: `🎰 **SLOTS** 🎰\n\n[ 🍒 | 🍇 | 7️⃣ ]\n\nÇeviriliyor...`
        });

        // Küçük bir gecikme (animasyon hissi)
        await new Promise(r => setTimeout(r, 1500));

        // Sonuçları belirle
        const result1 = slots[Math.floor(Math.random() * slots.length)];
        const result2 = slots[Math.floor(Math.random() * slots.length)];
        const result3 = slots[Math.floor(Math.random() * slots.length)];

        // Kazanma Kontrolü
        let winnings = 0;
        let message = '';
        let color = 0xE74C3C; // Kayıp (Kırmızı)

        // 3'ü aynı
        if (result1 === result2 && result2 === result3) {
            if (result1 === '7️⃣') {
                winnings = bet * 10;
                message = `**JACKPOT!** Muhteşem! **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0xF1C40F;
            } else if (result1 === '💎') {
                winnings = bet * 5;
                message = `**BÜYÜK KAZANÇ!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0x3498DB;
            } else {
                winnings = bet * 3;
                message = `**TEBRİKLER!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0x2ECC71;
            }
        }
        // 2'si aynı (2x)
        else if (result1 === result2 || result2 === result3 || result1 === result3) {
            winnings = bet * 2;
            message = `**Güzel!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
            color = 0x2ECC71;
        }
        // Kayıp
        else {
            message = `Kaybettiniz... **${bet.toLocaleString()} NexCoin** gitti.`;
        }

        let finalBalance = userData.balance;

        if (winnings > 0) {
            // Ödülü Ver (Atomik)
            const updatedUser = await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { balance: winnings } },
                { new: true }
            );
            finalBalance = updatedUser.balance;
        }

        // Sonucu düzenle
        await interaction.editReply({
            content: null,
            embeds: [{
                title: '🎰 Slot Machine',
                description: `**[ ${result1} | ${result2} | ${result3} ]**\n\n${message}`,
                color: color,
                footer: { text: `Bakiye: ${finalBalance.toLocaleString()} NexCoin` }
            }]
        });

        // Quest Update
        try {
            const { updateQuestProgress } = require('../../utils/questManager');
            await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
        } catch (e) { console.error(e); }
    }
};
