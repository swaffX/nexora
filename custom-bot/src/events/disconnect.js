const logger = require('../../../shared/logger');

module.exports = {
    name: 'disconnect',
    async execute(client) {
        logger.warn('[Custom] Bot Discord\'dan bağlantısı kesildi!');
    }
};
