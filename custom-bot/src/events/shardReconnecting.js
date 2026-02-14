const logger = require('../../../shared/logger');

module.exports = {
    name: 'shardReconnecting',
    async execute(shardId) {
        logger.info(`[Custom] Shard ${shardId} yeniden bağlanıyor...`);
    }
};
