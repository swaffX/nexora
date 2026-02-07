const { PermissionsBitField } = require('discord.js');
const logger = require('../shared/logger');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const VALORANT_ROLE_ID = '1466189076347486268';
        const LOBBY_VOICE_IDS = [
            '1463922466467483801', // Lobby 1
            '1467987380530184194', // Lobby 2
            '1467987533039403119'  // Lobby 3
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
