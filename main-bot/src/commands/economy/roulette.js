const { SlashCommandBuilder , MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Rulet oynayarak paranı katla!')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Bahis seçimin: kırmızı, siyah, yeşil veya 0-36 arası bir sayı')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Bahis miktarı')
                .setRequired(true)
                .setMinValue(10)), // Min 10 coin

    async execute(interaction) {
        const choiceInput = interaction.options.getString('choice').toLowerCase();
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // Validasyon
        let betType = 'unknown'; // 'color' or 'number'
        let betValue = null;

        const colors = {
            'kırmızı': ['1', '3', '5', '7', '9', '12', '14', '16', '18', '19', '21', '23', '25', '27', '30', '32', '34', '36'],
            'siyah': ['2', '4', '6', '8', '10', '11', '13', '15', '17', '20', '22', '24', '26', '28', '29', '31', '33', '35'],
            'yeşil': ['0']
        };

        // Girdi kontrolü
        if (['kırmızı', 'red', 'k'].includes(choiceInput)) { betType = 'color'; betValue = 'kırmızı'; }
        else if (['siyah', 'black', 's'].includes(choiceInput)) { betType = 'color'; betValue = 'siyah'; }
        else if (['yeşil', 'green', 'y'].includes(choiceInput)) { betType = 'color'; betValue = 'yeşil'; }
        else {
            const num = parseInt(choiceInput);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                betType = 'number';
                betValue = num.toString();
            }
        }

        if (betType === 'unknown') {
            return interaction.reply({ content: '❌ Geçersiz seçim! Lütfen **kırmızı**, **siyah**, **yeşil** veya **0-36** arası bir sayı girin.', flags: MessageFlags.Ephemeral });
        }

        // Bakiye Kontrolü
        // ATOMİK İŞLEM: Bakiye kontrolü ve düşümü tek seferde
        // Bu sayede "Race Condition" engellenir (Aynı anda 2 kere tıklayıp parayı çifte harcama vb.)
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } }, // Şart: Parası yetiyor mu?
            { $inc: { balance: -amount } }, // İşlem: Düş
            { new: true } // Güncel halini döndür
        );

        if (!user) {
            // User bulunamadı veya parası yetmedi (döndürülen değer null olur)
            // Ancak user hiç yoksa oluşturup sonra bakiye 0 diye hata vermek daha kullanıcı dostu olabilir ama
            // oyun komutu olduğu için bakiyesi 0 olan adamın DB'de olup olmaması çok fark etmez.
            const checkUser = await User.findOne({ odasi: userId, odaId: guildId });
            return interaction.reply({ content: `❌ Yetersiz bakiye! Mevcut: **${checkUser ? checkUser.balance : 0}**`, flags: MessageFlags.Ephemeral });
        }

        // ÇEVİR

        // ÇEVİR
        const winningNumber = Math.floor(Math.random() * 37).toString(); // 0-36

        // Kazanan Rengi Bul
        let winningColor = 'yeşil';
        if (colors['kırmızı'].includes(winningNumber)) winningColor = 'kırmızı';
        if (colors['siyah'].includes(winningNumber)) winningColor = 'siyah';

        // Emoji & Görsel
        const colorEmoji = { 'kırmızı': '🔴', 'siyah': '⚫', 'yeşil': '🟢' };

        let won = false;
        let payout = 0;

        if (betType === 'color') {
            if (betValue === winningColor) {
                won = true;
                payout = amount * 2;
                if (betValue === 'yeşil') payout = amount * 14; // Yeşil (0) x14 öder (Genelde)
            }
        } else if (betType === 'number') {
            if (betValue === winningNumber) {
                won = true;
                payout = amount * 36; // Sayı bahsi x36
            }
        }

        // Sonuç Mesajı
        let resultMsg = `🎰 **RULET** 🎰\n\n`;
        resultMsg += `Top Yuvarlanıyor... 🎱\n`;
        resultMsg += `Gelen: ${colorEmoji[winningColor]} **${winningNumber}** (${winningColor.toUpperCase()})\n\n`;

        if (won) {
            // ATOMİK İŞLEM: Ödülü Ver
            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { balance: payout } }
            );

            // Görüntü için local'de de artır (Zaten DB'ye işlendi)
            user.balance += payout;

            resultMsg += `🎉 **TEBRİKLER KAZANDIN!** 🎉\n`;
            resultMsg += `Yatırılan: **${amount}** => Kazanılan: **${payout}** (+${payout - amount})`;
        } else {
            resultMsg += `❌ **KAYBETTİN...**\n`;
            resultMsg += `Seçimin: ${betType === 'color' ? colorEmoji[betValue] : ''} ${betValue}\n`;
            resultMsg += `Kalan Bakiye: **${user.balance}**`;
        }

        // Quest Update
        try {
            const { updateQuestProgress } = require('../../utils/questManager');
            await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
        } catch (e) { console.error(e); }

        return interaction.reply({ content: resultMsg });
    }
};
