const { PermissionsBitField } = require('discord.js');
const logger = require('../../../shared/logger');
const CONFIG = require('../config');
const { MAIN_LOBBY, ADDITIONAL_LOBBIES } = require('../handlers/match/constants');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const VALORANT_ROLE_ID = CONFIG.ROLES.VALORANT;
        
        // Tüm aktif lobi ses kanallarını topla
        const LOBBY_VOICE_IDS = [
            MAIN_LOBBY.voiceId, // Ana lobi her zaman aktif
            // Ek lobiler (eğer enabled ve voiceId varsa)
            ...Object.values(ADDITIONAL_LOBBIES)
                .filter(lobby => lobby.enabled && lobby.voiceId)
                .map(lobby => lobby.voiceId)
        ].filter(Boolean); // null/undefined değerleri filtrele

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
                        logger.info(`[AutoRole] ${member.user.tag} lobi kanalına girdi, Valorant rolü verildi.`);
                    }
                } catch (error) {
                    logger.error(`[AutoRole Error] Rol verilirken hata: ${error.message}`);
                }
            }
        }

        // Kullanıcı kanaldan çıktığında hiçbir şey yapma (istek üzerine)
    }
};
