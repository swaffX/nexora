const mongoose = require('mongoose');

const cryptoSchema = new mongoose.Schema({
    name: { type: String, required: true },
    symbol: { type: String, required: true, unique: true },
    price: { type: Number, default: 100 },
    history: [{ type: Number }], // Son fiyatlar
    change: { type: Number, default: 0 } // Son değişim yüzdesi
});

module.exports = mongoose.model('Crypto', cryptoSchema);
