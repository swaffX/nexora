const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { Penal, Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`🛡️ Moderasyon Botu Devrede: ${client.user.tag}`);

        const activities = [
            { name: 'discord.gg/nexorahub', type: 1, url: 'https://www.twitch.tv/swaffval' },
            { name: 'made by swaff', type: 1, url: 'https://www.twitch.tv/swaffval' }
        ];

        let i = 0;
        client.user.setPresence({ activities: [activities[0]], status: 'dnd' });

        setInterval(() => {
            i = (i + 1) % activities.length;
            client.user.setPresence({ activities: [activities[i]], status: 'dnd' });
        }, 30000);

        // Ses Kanalına Gir
        try {
            const { joinVoiceChannel } = require('@discordjs/voice');
            const channel = client.channels.cache.get('1463921161925558485');
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true
                });
            }
        } catch (e) {
            logger.error('Ses bağlantı hatası:', e.message);
        }

        // --- CEZA KONTROL SİSTEMİ (DATABASE CHECK) ---
        logger.info('⏳ Ceza kontrol sistemi başlatılıyor...');

        setInterval(async () => {
            try {
                // DB Bağlantısı yoksa işlemi atla
                const mongoose = require('mongoose');
                if (mongoose.connection.readyState !== 1) return;

                const now = new Date();
                const expiredPenals = await Penal.find({ active: true, endTime: { $lte: now } });

                for (const penal of expiredPenals) {
                    const guild = client.guilds.cache.get(penal.guildId);
                    if (!guild) {
                        penal.active = false;
                        await penal.save();
                        continue;
                    }

                    if (penal.type === 'MUTE') {
                        // 1. Önce Sabit ID'yi Dene
                        const TARGET_ROLE_ID = '1464180689611129029';
                        let role = guild.roles.cache.get(TARGET_ROLE_ID);

                        // 2. Bulamazsa Adıyla Ara (Yedek)
                        if (!role) role = guild.roles.cache.find(r => r.name === 'Cezalı' || r.name.toLowerCase() === 'muted');

                        const member = await guild.members.fetch(penal.userId).catch(() => null);

                        if (member && role) {
                            await member.roles.remove(role, 'Süreli ceza bitti.');
                            logger.info(`✅ Mute kaldırıldı: ${penal.userId}`);
                        }
                    } else if (penal.type === 'BAN') {
                        await guild.members.unban(penal.userId, 'Süreli ban bitti.').catch(() => { });
                        logger.info(`✅ Ban kaldırıldı: ${penal.userId}`);
                    }

                    penal.active = false;
                    await penal.save();
                }
            } catch (err) {
                logger.error('Ceza kontrol hatası:', err);
            }
        }, 60 * 1000); // 1 Dakikada bir kontrol
    },
};
