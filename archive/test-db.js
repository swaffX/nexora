// MongoDB bağlantı testi
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

console.log('MongoDB\'ye bağlanılıyor...');
console.log('URI:', uri.replace(/:([^@]+)@/, ':****@'));

mongoose.connect(uri)
    .then(() => {
        console.log('✅ MongoDB bağlantısı başarılı!');
        console.log('Veritabanı:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);

        // Test koleksiyonu oluştur
        return mongoose.connection.db.admin().ping();
    })
    .then(() => {
        console.log('✅ Ping başarılı!');
        console.log('\n🎉 MongoDB tamamen çalışıyor!');
        mongoose.disconnect();
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ MongoDB bağlantı hatası:', err.message);
        process.exit(1);
    });
