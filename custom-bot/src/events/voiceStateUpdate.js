const { PermissionsBitField } = require('discord.js');
const logger = require('../../../shared/logger');
const CONFIG = require('../config');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const VALORANT_ROLE_ID = CONFIG.ROLES.VALORANT;
        const LOBBY_VOICE_IDS = [
            CONFIG.CHANNELS.LOBBY_VOICE_1,
            CONFIG.CHANNELS.LOBBY_VOICE_2,
            CONFIG.CHANNELS.LOBBY_VOICE_3
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
