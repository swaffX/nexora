const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../../shared/models/User');
const Crypto = require('../../../../shared/models/Crypto');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crypto')
        .setDescription('Sanal Borsa Sistemi')
        .addSubcommand(sub =>
            sub.setName('market')
                .setDescription('Güncel kripto para fiyatlarını gör'))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Kripto para satın al')
                .addStringOption(opt => opt.setName('coin').setDescription('Hangi coin? (BTC, ETH, DOGE)').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Ne kadarlık alım yapacaksın? (Miktar)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Kripto para sat')
                .addStringOption(opt => opt.setName('coin').setDescription('Hangi coin? (BTC, ETH, DOGE)').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Kaç adet satacaksın?').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Başlangıç verileri oluştur (Yoksa)
        const START_PRICES = {
            'BTC': 5000,
            'ETH': 300,
            'DOGE': 10
        };

        const checkMarket = async () => {
            for (const [symbol, price] of Object.entries(START_PRICES)) {
                let coin = await Crypto.findOne({ symbol });
                if (!coin) {
                    await Crypto.create({
                        name: symbol,
                        symbol: symbol,
                        price: price
                    });
                }
            }
        };
        await checkMarket();

        if (subcommand === 'market') {
            const coins = await Crypto.find({});
            const embed = new EmbedBuilder()
                .setTitle('📈 Nexora Sanal Borsa')
                .setColor('#3498db')
                .setDescription('Her 10 dakikada bir fiyatlar güncellenir.')
                .setTimestamp();

            coins.forEach(coin => {
                const changeEmoji = coin.change >= 0 ? '🟢' : '🔴';
                const percent = coin.change !== undefined ? coin.change.toFixed(2) : 0;
                embed.addFields({
                    name: `${coin.symbol}`,
                    value: `Fiyat: **${coin.price.toFixed(2)}**\nDeğişim: ${changeEmoji} %${percent}`,
                    inline: true
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'buy') {
            const symbol = interaction.options.getString('coin').toUpperCase();
            const amount = interaction.options.getInteger('amount'); // Tutar olarak (kaç liralık)

            if (!['BTC', 'ETH', 'DOGE'].includes(symbol)) {
                return interaction.reply({ content: '❌ Geçersiz coin! Sadece BTC, ETH, DOGE alınabilir.', ephemeral: true });
            }

            const coin = await Crypto.findOne({ symbol });
            if (!coin) return interaction.reply({ content: '❌ Borsa verisi alınamadı.', ephemeral: true });

            // Atomik Satın Alma
            // Önce para var mı?
            const user = await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true }
            );

            if (!user) {
                return interaction.reply({ content: '❌ Yetersiz bakiye!', ephemeral: true });
            }

            // Coin ekle
            const coinAmount = amount / coin.price;

            // Map kullanımı
            const fieldMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'DOGE': 'dogecoin' };
            const walletField = `cryptoWallet.${fieldMap[symbol]}`;

            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { [walletField]: coinAmount } }
            );

            return interaction.reply({ content: `✅ **${amount}** coin karşılığında **${coinAmount.toFixed(4)} ${symbol}** aldın.` });
        }

        if (subcommand === 'sell') {
            const symbol = interaction.options.getString('coin').toUpperCase();
            const amount = interaction.options.getInteger('amount'); // ADET olarak sat

            if (!['BTC', 'ETH', 'DOGE'].includes(symbol)) {
                return interaction.reply({ content: '❌ Geçersiz coin!', ephemeral: true });
            }

            const coin = await Crypto.findOne({ symbol });
            const fieldMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'DOGE': 'dogecoin' };
            const walletField = `cryptoWallet.${fieldMap[symbol]}`;

            // Coin var mı?
            // MongoDB sorgusuyla: { 'cryptoWallet.bitcoin': { $gte: amount } }
            const query = { odasi: userId, odaId: guildId };
            query[walletField] = { $gte: amount };

            const user = await User.findOne(query);
            if (!user) {
                return interaction.reply({ content: `❌ Hesabında satacak kadar **${symbol}** yok!`, ephemeral: true });
            }

            // Satış Değeri
            const totalValue = amount * coin.price;

            // Atomik Satış
            // 1. Coini düş
            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { [walletField]: -amount } }
            );

            // 2. Parayı ekle
            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { balance: totalValue } }
            );

            return interaction.reply({ content: `✅ **${amount} ${symbol}** satıldı. Hesabına **${Math.floor(totalValue)}** coin eklendi.` });
        }
    }
};
