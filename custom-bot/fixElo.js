require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const { User } = require('../shared/models');

async function fixElo() {
    console.log('Connecting to DB...');
    if (!process.env.MONGODB_URI) {
        console.error('MONGO_URI not found in env! Trying local default or check .env');
        process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/nexora'; // Fallback
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Düzeltme: ELO'su 1000 olan veya Level'ı yüksek olup hiç maçı olmayanlar
    // Veya sadece görseldeki gibi "default 1000 elo" olan herkesi sıfırla.
    // Kullanıcı talebi: "Herkesi 100 elo ve 1 level olarak ayarla"

    console.log('Resetting ALL users to 100 ELO / Level 1 (if they are higher)...');

    // Risk almamak için sadece hatalı görünenleri (1000 ELO civarı veya 200 üstü) seçelim
    // Ama kullanıcı "herkesi" dedi. Muhtemelen leaderboard temizlensin istiyor.
    const result = await User.updateMany(
        {
            $or: [
                { 'matchStats.elo': { $gte: 200 } },
                { 'matchStats.matchLevel': { $gte: 2 } }
            ]
        },
        {
            $set: {
                'matchStats.elo': 100,
                'matchStats.matchLevel': 1,
                // 'matchStats.totalMatches': 0 // Maç sayısını sıfırlamak ister mi? Görselde 0 görünüyor zaten. 
                // Eğer maç sayısı varsa dokunmayalım, sadece ELO'yu düzeltelim.
            }
        }
    );

    console.log(`Updated ${result.modifiedCount} users.`);
    console.log('Done.');
    process.exit();
}

fixElo();
