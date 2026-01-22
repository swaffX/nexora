require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Guild } = require('./shared/models');

const GUILD_ID = process.env.GUILD_ID;
const REGISTER_CHANNEL_ID = '1463875473703436289';
const CHAT_CHANNEL_ID = '1463875477377912853';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function setupV3() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Bot loglanıyor...');
        await client.login(process.env.TOKEN);
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) throw new Error('Sunucu bulunamadı!');

        console.log('Level kanalları oluşturuluyor...');

        // LOGS Kategorisini bul (daha önce oluşturmuştuk) veya oluştur
        let category = guild.channels.cache.find(c => c.name === 'LOGS' && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: 'LOGS',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });
        }

        // Level Log Kanalı
        const levelLogChannel = await guild.channels.create({
            name: 'level-logs',
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
        });
        console.log('✅ Level Log Kanalı:', levelLogChannel.id);

        // Leaderboard Kanalı (Herkese açık ama salt okunur)
        const leaderboardChannel = await guild.channels.create({
            name: '🏆-leaderboard',
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] }
            ]
        });
        console.log('✅ Leaderboard Kanalı:', leaderboardChannel.id);

        console.log('Ayarlar güncelleniyor...');

        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            {
                $set: {
                    // Ticket Sistemi İPTAL
                    'ticket.enabled': false,

                    // Kayıt Sistemi (Butonlu)
                    'register.enabled': true,
                    'register.verifyChannelId': REGISTER_CHANNEL_ID, // Buton buraya atılacak
                    'register.chatChannelId': CHAT_CHANNEL_ID,       // Hoşgeldin mesajı buraya

                    // Roller (Değişmedi ama garanti olsun)
                    'register.unregisteredRoleId': '1463875341553635553',
                    'register.registeredRoleId': '1463875340513317089',

                    // Level Sistemi AKTİF
                    'levelSystem.enabled': true,
                    'levelSystem.logChannelId': levelLogChannel.id,
                    'levelSystem.leaderboardChannelId': leaderboardChannel.id,
                    'levelSystem.multiplier': 1
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ Setup V3 Tamamlandı.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

setupV3();
