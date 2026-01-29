const mongoose = require('mongoose');
const logger = require('./logger');

class Database {
    constructor() {
        this.connection = null;
    }

    async connect(uri) {
        try {
            this.connection = await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 5000, // 5 saniye içinde bağlanamazsa hata ver
                socketTimeoutMS: 45000, // 45 saniye işlem süresi
            });
            logger.success('MongoDB bağlantısı başarılı!');
            return this.connection;
        } catch (error) {
            logger.error('MongoDB bağlantı hatası:', error.message);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.connection) {
            await mongoose.disconnect();
            logger.info('MongoDB bağlantısı kapatıldı.');
        }
    }

    isConnected() {
        return mongoose.connection.readyState === 1;
    }
}

module.exports = new Database();
