const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild, client) {
        if (!oldGuild.available || !newGuild.available) return;

        const changes = [];

        // İsim Değişikliği
        if (oldGuild.name !== newGuild.name) {
            changes.push(`**İsim:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
        }

        // Açıklama Değişikliği
        if (oldGuild.description !== newGuild.description) {
            changes.push(`**Açıklama:** Değiştirildi.`);
        }

        // Banner Değişikliği
        if (oldGuild.banner !== newGuild.banner) {
            changes.push(`**Banner:** Değiştirildi.`);
        }

        // Icon Değişikliği
        if (oldGuild.icon !== newGuild.icon) {
            changes.push(`**Icon:** Değiştirildi.`);
        }

        // Splash Değişikliği
        if (oldGuild.splash !== newGuild.splash) {
            changes.push(`**Splash:** Değiştirildi.`);
        }

        // Discovery Splash Değişikliği
        if (oldGuild.discoverySplash !== newGuild.discoverySplash) {
            changes.push(`**Discovery Splash:** Değiştirildi.`);
        }

        // AFK Kanalı
        if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
            const oldAfk = oldGuild.afkChannel ? oldGuild.afkChannel.name : 'Yok';
            const newAfk = newGuild.afkChannel ? newGuild.afkChannel.name : 'Yok';
            changes.push(`**AFK Kanalı:** \`${oldAfk}\` ➔ \`${newAfk}\``);
        }

        // Verification Level
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
            changes.push(`**Doğrulama Seviyesi:** \`${oldGuild.verificationLevel}\` ➔ \`${newGuild.verificationLevel}\``);
        }

        if (changes.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setTitle('⚙️ Sunucu Güncellendi')
                .addFields({ name: 'Değişiklikler', value: changes.join('\n\n') })
                .setThumbnail(newGuild.iconURL())
                .setTimestamp();

            await sendLog(client, newGuild.id, 'server', embed);
        }
    }
};
