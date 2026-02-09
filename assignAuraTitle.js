/**
 * Tek Seferlik Script: Kullanıcıya "Aura" Title Verme
 * Kullanım: node assignAuraTitle.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User } = require('./shared/models');

const TARGET_USER_ID = '333319658973429762';
const TITLE_NAME = 'Aura';

async function main() {
    try {
        // Veritabanı Bağlantısı
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB bağlantısı başarılı');

        // Kullanıcıyı Bul
        const user = await User.findOne({ odasi: TARGET_USER_ID });

        if (!user) {
            console.log('❌ Kullanıcı bulunamadı:', TARGET_USER_ID);
            process.exit(1);
        }

        console.log('👤 Kullanıcı bulundu:', user.odasi);

        // matchStats yoksa oluştur
        if (!user.matchStats) {
            user.matchStats = {
                totalMatches: 0,
                totalWins: 0,
                winStreak: 0,
                totalLosses: 0,
                elo: 200,
                matchLevel: 1,
                totalMVPs: 0,
                titles: [],
                activeTitle: null
            };
        }

        // titles array'i yoksa oluştur
        if (!user.matchStats.titles) {
            user.matchStats.titles = [];
        }

        // Title zaten var mı kontrol et
        if (user.matchStats.titles.includes(TITLE_NAME)) {
            console.log('⚠️ Kullanıcı zaten bu title\'a sahip');
        } else {
            user.matchStats.titles.push(TITLE_NAME);
            console.log('✨ Title eklendi:', TITLE_NAME);
        }

        // Aktif title olarak ayarla
        user.matchStats.activeTitle = TITLE_NAME;
        console.log('🎯 Aktif title ayarlandı:', TITLE_NAME);

        // Kaydet
        await user.save();
        console.log('💾 Değişiklikler kaydedildi!');

        console.log('\n📊 Güncel matchStats:');
        console.log(JSON.stringify(user.matchStats, null, 2));

    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Veritabanı bağlantısı kapatıldı');
    }
}

main();
