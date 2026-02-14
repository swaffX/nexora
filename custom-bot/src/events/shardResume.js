const logger = require('../../../shared/logger');

module.exports = {
    name: 'shardResume',
    async execute(shardId, replayedEvents) {
        logger.success(`[Custom] Shard ${shardId} başarıyla yeniden bağlandı! (${replayedEvents} event replay edildi)`);
    }
};
