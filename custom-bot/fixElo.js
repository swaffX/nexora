const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { User } = require('../shared/models');

async function fixElo() {
    console.log('------------------------------------------------');
    console.log('Starting ELO Fix Script...');

    // Debug: URI'nin yüklendiğini kontrol et
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ ERROR: MONGODB_URI is undefined! Environment variable not loaded.');
        console.log('Attempted to load .env from:', path.join(__dirname, '..', '.env'));
        console.log('Current Directory:', __dirname);
        process.exit(1);
    }

    // Maskeli URI göster
    const maskedUri = uri.includes('@') ? uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'Local/Unmasked URI';
    console.log(`🔌 Connecting to: ${maskedUri}`);

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000 // 5 saniye
        });
        console.log('✅ MongoDB Connected Successfully.');
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    }

    console.log('🔄 Logic Running: Setting high ELO users back to 100 ELO / Level 1...');

    try {
        const result = await User.updateMany(
            {
                $or: [
                    { 'matchStats.elo': { $gte: 150 } }, // 150 üstü herkesi sıfırlıyoruz (Kullanıcı herkes dedi)
                    { 'matchStats.matchLevel': { $gte: 2 } },
                    { 'matchStats.elo': 1000 }
                ]
            },
            {
                $set: {
                    'matchStats.elo': 100,
                    'matchStats.matchLevel': 1,
                    // 'matchStats.totalMatches': 0 // İsteğe bağlı
                }
            }
        );
        console.log(`✅ Update Complete: ${result.modifiedCount} users verified/fixed.`);

    } catch (err) {
        console.error('❌ Update Error:', err);
    }

    console.log('Done. Exiting...');
    process.exit(0);
}

fixElo();
