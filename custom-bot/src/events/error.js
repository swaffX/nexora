const logger = require('../../../shared/logger');

module.exports = {
    name: 'error',
    async execute(error) {
        logger.error('[Custom] Discord.js Error:', error);
        
        // 521 hatası için özel mesaj
        if (error.message && error.message.includes('521')) {
            logger.warn('[Custom] Discord Gateway geçici olarak erişilemez durumda. Bot otomatik olarak yeniden bağlanacak...');
        }
    }
};
