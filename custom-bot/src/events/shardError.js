const logger = require('../../../shared/logger');

module.exports = {
    name: 'shardError',
    async execute(error, shardId) {
        logger.error(`[Custom] Shard ${shardId} Error:`, error);
        
        // WebSocket hataları için özel işlem
        if (error.message && (error.message.includes('521') || error.message.includes('Unexpected server response'))) {
            logger.warn(`[Custom] Shard ${shardId} Discord Gateway bağlantı hatası. Otomatik yeniden bağlanma devrede...`);
        }
    }
};
