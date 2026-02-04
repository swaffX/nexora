const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { User } = require('../shared/models');

async function fixElo() {
    console.log('------------------------------------------------');
    console.log('Starting ELO Fix Script (Robust Version)...');

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI missing.');
        process.exit(1);
    }

    // Bağlantı ayarları
    const options = {
        serverSelectionTimeoutMS: 30000, // 30 sn bekle
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        bufferCommands: false // Bağlantı yoksa bekleme, direkt hata ver (Sorunu anlamak için)
    };

    console.log('🔌 Connecting...');

    try {
        await mongoose.connect(uri, options);
        console.log('✅ Connected to MongoDB.');

        // Bağlantının "gerçekten" hazır olduğundan emin olmak için ufak bir bekleme ve ping
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Basit bir read işlemi deneyelim
        const testCount = await User.countDocuments().exec();
        console.log(`📊 DB Connection Verified. Total Users in DB: ${testCount}`);

        console.log('🔄 Running Update Command...');

        const result = await User.updateMany(
            {
                $or: [
                    { 'matchStats.elo': { $gte: 200 } },
                    { 'matchStats.matchLevel': { $gt: 1 } },
                    { 'matchStats.elo': 1000 }
                ]
            },
            {
                $set: {
                    'matchStats.elo': 100,
                    'matchStats.matchLevel': 1
                }
            }
        ).exec(); // .exec() kullanımı bazen buffer sorununu çözer

        console.log(`✅ SUCCESS! Updated ${result.modifiedCount} users.`);

    } catch (err) {
        console.error('❌ CRITICAL ERROR:', err);
    } finally {
        console.log('👋 Closing connection...');
        await mongoose.disconnect();
        process.exit(0);
    }
}

fixElo();
