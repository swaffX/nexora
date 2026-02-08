const { PermissionsBitField } = require('discord.js');
const logger = require('../../../shared/logger');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const VALORANT_ROLE_ID = '1466189076347486268';
        const LOBBY_VOICE_IDS = [
            '1469371485855547587', // Lobby 1
            '1469371487965286400', // Lobby 2
            '1469371490163097600'  // Lobby 3
        ];

        const member = newState.member;
        if (!member || member.user.bot) return;

        const newChannelId = newState.channelId;
        const oldChannelId = oldState.channelId;

        // Sadece kanala yeni giriş yapıldığında (veya kanal değiştirildiğinde)
        if (newChannelId && newChannelId !== oldChannelId) {
            if (LOBBY_VOICE_IDS.includes(newChannelId)) {
                try {
                    const role = member.guild.roles.cache.get(VALORANT_ROLE_ID);
                    if (role && !member.roles.cache.has(VALORANT_ROLE_ID)) {
                        await member.roles.add(role);
                        // logger.info(`[AutoRole] ${member.user.tag} lobi kanalına girdi, Valorant rolü verildi.`);
                    }
                } catch (error) {
                    logger.error(`[AutoRole Error] Rol verilirken hata: ${error.message}`);
                }
            }
        }

        // Kullanıcı kanaldan çıktığında hiçbir şey yapma (istek üzerine)
    }
};
