const CronJob = require('cron').CronJob;
const Crypto = require('../../../../shared/models/Crypto');

module.exports = {
    start: () => {
        // Her 10 dakikada bir çalışır: '0 */10 * * * *'
        // Test için her dakika: '0 * * * * *'
        const job = new CronJob('0 */5 * * * *', async function () {
            try {
                const coins = await Crypto.find({});
                for (const coin of coins) {
                    // Rastgele değişim (-%5 ile +%5 arası)
                    // Trend faktörü eklenebilir ama basit tutalım.
                    const changePercent = (Math.random() * 10) - 5;
                    const multiplier = 1 + (changePercent / 100);

                    coin.price = coin.price * multiplier;

                    // Min fiyat koruması
                    if (coin.price < 0.1) coin.price = 0.1;

                    coin.change = changePercent;
                    coin.history.push(coin.price);

                    // History çok şişmesin
                    if (coin.history.length > 50) coin.history.shift();

                    await coin.save();
                }
                console.log('[CRYPTO] Piyasa güncellendi.');
            } catch (e) {
                console.error('[CRYPTO] Cron hatası:', e);
            }
        });

        job.start();
        console.log('[CRYPTO] Pazar döngüsü başlatıldı (5dk).');
    }
};
