const { Events } = require('discord.js');
const path = require('path');
const { CronJob } = require('cron');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`👁️ Supervisor Bot Devrede: ${client.user.tag}`);
        client.user.setPresence({
            activities: [{ name: 'Yetkilileri İzliyor 🕵️', type: 3 }],
            status: 'dnd'
        });

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
        } catch (e) { }

        // --- HAFTALIK YETKİLİ RAPORU (Pazar 23:00) ---
        const reportJob = new CronJob('0 23 * * 0', async () => {
            const guildId = '1463875324021182536'; // Ana sunucu ID (veya parametrik)
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return;

            const staffChannel = guild.channels.cache.find(c => c.name.includes('yetkili-chat') || c.name.includes('staff-chat'));
            if (!staffChannel) return;

            // Basit istatistik (Sadece mesaj sayısını User modelinden çekiyoruz diyelim)
            // Not: Detaylı ses verisi için VoiceStateUpdate dinleyip DB'ye yazmak gerekir. 
            // Şimdilik sadece "Rapor Zamanı!" hatırlatması yapalım.

            await staffChannel.send('📢 **Haftalık Rapor Zamanı!**\nLütfen tüm yetkililer hafta boyunca yaptıkları kayıt ve moderasyon işlemlerini kontrol etsin. İyi geceler!');

            logger.info('Haftalık rapor hatırlatması gönderildi.');
        }, null, true, 'Europe/Istanbul');

        reportJob.start();
        logger.info('📅 Haftalık rapor cron job başlatıldı.');
    },
};
