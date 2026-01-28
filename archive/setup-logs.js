require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Guild } = require('./shared/models');

const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function setupLogs() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Bot giriş yapıyor...');
        await client.login(process.env.TOKEN);

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) throw new Error('Sunucu bulunamadı!');

        await guild.roles.fetch(); // Rolleri yükle

        console.log('LOGS kategorisi oluşturuluyor...');

        // Kategori Oluştur
        const category = await guild.channels.create({
            name: 'LOGS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id, // Doğrusu bu
                    deny: [PermissionFlagsBits.ViewChannel] // Herkesden gizle
                }
            ]
        });

        const channels = [
            { name: 'message-logs', key: 'message' },
            { name: 'member-logs', key: 'member' },
            { name: 'mod-logs', key: 'moderation' },
            { name: 'role-logs', key: 'role' },
            { name: 'channel-logs', key: 'channel' },
            { name: 'voice-logs', key: 'voice' },
            { name: 'server-logs', key: 'server' }
        ];

        const savedIds = {};

        console.log('Kanallar oluşturuluyor...');
        for (const ch of channels) {
            const channel = await guild.channels.create({
                name: ch.name,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
            savedIds[`logs.${ch.key}`] = channel.id;
            console.log(`✅ ${ch.name} oluşturuldu.`);
        }

        // DB Kayıt
        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            { $set: savedIds },
            { new: true, upsert: true }
        );

        console.log('Veritabanı güncellendi.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

setupLogs();
