const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const MULTIPLIERS = [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plinko')
        .setDescription('Plinko: Topu bırak, çarpanı yakala!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true)),

    async execute(interaction) {
        const betInput = interaction.options.getString('bahis');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // User Check
        let userCheck = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userCheck) return interaction.reply({ content: '❌ Kaydınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount)) return interaction.reply({ content: '❌ Geçersiz miktar.', flags: MessageFlags.Ephemeral });
        }

        // 0 Bakiye ve Limit
        if (amount <= 0) return interaction.reply({ content: '❌ Bakiye yetersiz!', flags: MessageFlags.Ephemeral });
        if (amount < 20) return interaction.reply({ content: '❌ Min 20 NexCoin.', flags: MessageFlags.Ephemeral });

        // Düşüş
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // PLINKO MANTIĞI
        // 8 Satır. Her satırda %50 Sağ/Sol.
        // Sol = 0, Sağ = 1.
        // Toplam Sağ sayısı = Index.
        // Örn: Hepsinde sağa giderse 8. index (En sağ uç). Hepsinde sol 0. index (En sol uç).
        // 4 sağ 4 sol -> 4. index (Orta).

        let pathStr = '';
        let rightCount = 0;
        const rows = 8;

        for (let i = 0; i < rows; i++) {
            if (Math.random() < 0.5) {
                // Sol
                pathStr += 'L';
            } else {
                // Sağ
                pathStr += 'R';
                rightCount++;
            }
        }

        const multiplier = MULTIPLIERS[rightCount];
        const winAmount = Math.floor(amount * multiplier);

        // Görselleştirme (Basit ASCII Board)
        // Topun düştüğü yeri gösterelim
        let board = `
🔴
🔘🔘
🔘🔘🔘
🔘🔘🔘🔘
🔘🔘🔘🔘🔘
🔘🔘🔘🔘🔘🔘
🔘🔘🔘🔘🔘🔘🔘
🔘🔘🔘🔘🔘🔘🔘🔘
`;
        // Kazanç slotlarını göster
        // Mevcut indexi vurgula
        const emojis = ['🟩', '🟨', '🟧', '🟧', '🟥', '🟧', '🟧', '🟨', '🟩']; // Renkler (Yeşil=Yüksek, Kırmızı=Düşük)

        let resultBar = '';
        for (let i = 0; i < MULTIPLIERS.length; i++) {
            if (i === rightCount) resultBar += '📍'; // Topun olduğu yer
            else resultBar += '➖';
        }

        const embed = new EmbedBuilder()
            .setTitle('🎯 PLINKO')
            .setDescription(`Bahis: **${amount}** NexCoin\n\n${board}\n**Çarpanlar:** [ ${MULTIPLIERS.join(' | ')} ]\n\nSonuç:\n${resultBar}\n\n**${multiplier}x** Çarpan!`)
            .setColor(multiplier > 1 ? '#2ecc71' : '#e74c3c');

        if (winAmount > 0) {
            await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmount } });
            embed.addFields({ name: 'Kazanç', value: `💰 **${winAmount}** NexCoin` });
        } else {
            embed.addFields({ name: 'Kayıp', value: 'Şansına küs...' });
        }

        await interaction.reply({ embeds: [embed] });

        // Quest Update
        try {
            const { updateQuestProgress } = require('../../utils/questManager');
            await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
        } catch (e) { }
    }
};
