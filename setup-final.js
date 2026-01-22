require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Guild } = require('./shared/models');

const GUILD_ID = process.env.GUILD_ID;
const GOODBYE_CHANNEL_ID = '1463875500949639331';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function setupFinal() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Bot giriş yapıyor...');
        await client.login(process.env.TOKEN);

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) throw new Error('Sunucu bulunamadı!');

        await guild.roles.fetch();

        console.log('Eksik kanallar kontrol ediliyor...');

        // 1. LOGS Kategorisi
        let category = guild.channels.cache.find(c => c.name === 'LOGS' && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: 'LOGS',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });
            console.log('✅ LOGS Kategorisi oluşturuldu.');
        }

        async function getOrCreateChannel(name, parent = null, isPublic = false) {
            let ch = guild.channels.cache.find(c => c.name === name);
            if (!ch) {
                ch = await guild.channels.create({
                    name: name,
                    type: ChannelType.GuildText,
                    parent: parent,
                    permissionOverwrites: isPublic ? [] : [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
                });
                console.log(`✅ ${name} oluşturuldu.`);
            } else {
                console.log(`ℹ️ ${name} zaten var (${ch.id}).`);
            }
            return ch;
        }

        const memberLogCh = await getOrCreateChannel('member-logs', category.id);
        const levelLogCh = await getOrCreateChannel('level-logs', category.id);
        const leaderboardCh = await getOrCreateChannel('🏆-leaderboard', null, true);
        const messageLogCh = await getOrCreateChannel('message-logs', category.id);

        console.log('Veritabanı güncelleniyor...');

        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            {
                $set: {
                    // Loglar
                    'logs.enabled': true,
                    'logs.member': memberLogCh.id,
                    'logs.message': messageLogCh.id,

                    // Goodbye
                    'goodbye.enabled': true,
                    'goodbye.channelId': GOODBYE_CHANNEL_ID,

                    // Level
                    'levelSystem.enabled': true,
                    'levelSystem.logChannelId': levelLogCh.id,
                    'levelSystem.leaderboardChannelId': leaderboardCh.id
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ Setup Final Tamamlandı.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

setupFinal();
