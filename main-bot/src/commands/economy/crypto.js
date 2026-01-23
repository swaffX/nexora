const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const User = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'User'));
const Crypto = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'Crypto'));
const { createCryptoChart } = require('../../utils/cryptoChart');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crypto')
        .setDescription('Sanal Borsa Sistemi')
        .addSubcommand(sub =>
            sub.setName('market')
                .setDescription('Güncel kripto para fiyatlarını gör'))
        .addSubcommand(sub =>
            sub.setName('chart')
                .setDescription('Kripto para grafiklerini gör')
                .addStringOption(opt => opt.setName('coin').setDescription('Hangi coin? (BTC, ETH, DOGE)').setRequired(true)))
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
                .setDescription('Her 10 dakikada bir fiyatlar güncellenir. Detaylı analiz için `/crypto chart` kullanın.')
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

        if (subcommand === 'chart') {
            const symbol = interaction.options.getString('coin').toUpperCase();

            if (!['BTC', 'ETH', 'DOGE'].includes(symbol)) {
                return interaction.reply({ content: '❌ Geçersiz coin! Sadece BTC, ETH, DOGE destekleniyor.', flags: 64 });
            }

            await interaction.deferReply();

            const coin = await Crypto.findOne({ symbol });
            if (!coin) return interaction.editReply({ content: '❌ Veri bulunamadı.' });

            try {
                const imageBuffer = await createCryptoChart(symbol, coin.history, coin.price);
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'chart.png' });

                const percent = coin.change !== undefined ? coin.change.toFixed(2) : 0;
                const changeEmoji = coin.change >= 0 ? '🟢' : '🔴';

                const embed = new EmbedBuilder()
                    .setColor(coin.change >= 0 ? '#00ffa3' : '#ff4d4d')
                    .setTitle(`📊 ${symbol} Fiyat Analizi`)
                    .setDescription(`**Anlık Fiyat:** $${coin.price.toFixed(2)}\n**Değişim (24s):** ${changeEmoji} %${percent}`)
                    .setImage('attachment://chart.png')
                    .setFooter({ text: 'Nexora Crypto Market' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], files: [attachment] });

            } catch (error) {
                console.error('Chart Hatası:', error);
                await interaction.editReply({ content: '❌ Grafik oluşturulurken bir hata oluştu.' });
            }
            return;
        }

        if (subcommand === 'buy') {
            const symbol = interaction.options.getString('coin').toUpperCase();
            const amount = interaction.options.getInteger('amount');

            if (!['BTC', 'ETH', 'DOGE'].includes(symbol)) {
                return interaction.reply({ content: '❌ Geçersiz coin! Sadece BTC, ETH, DOGE alınabilir.', flags: 64 });
            }

            const coin = await Crypto.findOne({ symbol });
            if (!coin) return interaction.reply({ content: '❌ Borsa verisi alınamadı.', flags: 64 });

            // Atomik Satın Alma
            const user = await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true }
            );

            if (!user) {
                return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: 64 });
            }

            // Coin Miktarı
            const coinAmount = amount / coin.price;

            // Cüzdan Güncelle
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
            const amount = interaction.options.getInteger('amount'); // ADET

            if (!['BTC', 'ETH', 'DOGE'].includes(symbol)) {
                return interaction.reply({ content: '❌ Geçersiz coin!', flags: 64 });
            }

            const coin = await Crypto.findOne({ symbol });
            if (!coin) return interaction.reply({ content: '❌ Borsa verisi alınamadı.', flags: 64 });

            const fieldMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'DOGE': 'dogecoin' };
            const walletField = `cryptoWallet.${fieldMap[symbol]}`;

            // Coin Kontrolü (Önce adet var mı?)
            const query = { odasi: userId, odaId: guildId };
            query[walletField] = { $gte: amount };

            const userCheck = await User.findOne(query);
            if (!userCheck) {
                return interaction.reply({ content: `❌ Hesabında satacak kadar **${symbol}** yok!`, flags: 64 });
            }

            // Satış Değeri
            const totalValue = amount * coin.price;

            // Atomik Satış: Coin Düş
            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { [walletField]: -amount } }
            );

            // Para Ekle
            await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { balance: totalValue } }
            );

            return interaction.reply({ content: `✅ **${amount} ${symbol}** satıldı. Hesabına **${Math.floor(totalValue)}** coin eklendi.` });
        }
    }
};
