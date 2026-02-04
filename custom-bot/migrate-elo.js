/**
 * Mevcut 100 ELO kullanıcılarını 200'e yükseltme scripti
 * Tek seferlik çalıştırılır: node migrate-elo.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require(path.join(__dirname, '..', 'shared', 'database'));
const { User } = require(path.join(__dirname, '..', 'shared', 'models'));

async function migrateElo() {
    try {
        console.log('🔄 MongoDB bağlanıyor...');
        await db.connect(process.env.MONGODB_URI);

        console.log('📊 100 ELO kullanıcıları aranıyor...');

        // 100 veya altında ELO'su olan kullanıcıları 200'e çek
        const result = await User.updateMany(
            { 'matchStats.elo': { $lte: 100 } },
            { $set: { 'matchStats.elo': 200 } }
        );

        console.log(`✅ ${result.modifiedCount} kullanıcı 200 ELO'ya yükseltildi!`);

        // İstatistik
        const total = await User.countDocuments({ 'matchStats.elo': { $exists: true } });
        console.log(`📈 Toplam ELO kaydı: ${total}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

migrateElo();
