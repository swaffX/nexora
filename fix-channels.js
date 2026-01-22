require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { Guild } = require('./shared/models');

const GUILD_ID = process.env.GUILD_ID;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function fixChannels() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);
        await client.login(process.env.TOKEN);

        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.roles.fetch();

        console.log('Kanallar yapılandırılıyor...');

        // Yardımcı Fonksiyon: Public ama salt okunur kanal oluştur (Bot yazabilir)
        async function createPublicChannel(name) {
            return await guild.channels.create({
                name: name,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.EmbedLinks]
                    }
                ]
            });
        }

        // 1. Welcome & Goodbye
        const welcomeCh = await createPublicChannel('👋-welcome');
        console.log(`✅ Welcome Kanalı: ${welcomeCh.name}`);

        const goodbyeCh = await createPublicChannel('👋-goodbye');
        console.log(`✅ Goodbye Kanalı: ${goodbyeCh.name}`);

        // 2. Levels Kanalı (Public)
        const levelsCh = await createPublicChannel('🆙-levels');
        console.log(`✅ Levels Kanalı: ${levelsCh.name}`);

        // 3. Eski level-logs sil
        const oldLevelLog = guild.channels.cache.find(c => c.name === 'level-logs');
        if (oldLevelLog) {
            await oldLevelLog.delete();
            console.log('🗑️ Eski level-logs silindi.');
        }

        // 4. Leaderboard Kanalı
        let leaderboardCh = guild.channels.cache.find(c => c.name.includes('leaderboard'));
        if (!leaderboardCh) {
            leaderboardCh = await createPublicChannel('🏆-leaderboard');
            console.log(`✅ Leaderboard Kanalı: ${leaderboardCh.name}`);
        } else {
            // İzinleri güncelle (Bot yazabilsin)
            await leaderboardCh.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, ViewChannel: true });
            await leaderboardCh.permissionOverwrites.edit(client.user, { SendMessages: true, ViewChannel: true, EmbedLinks: true });

            // Temizle
            try { await leaderboardCh.bulkDelete(10); } catch (e) { }
            console.log(`♻️ Leaderboard kanalı güncellendi.`);
        }

        // 5. DB Kayıt
        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            {
                $set: {
                    'welcome.channelId': welcomeCh.id,
                    'welcome.enabled': true,

                    'goodbye.channelId': goodbyeCh.id,
                    'goodbye.enabled': true,

                    'levelSystem.logChannelId': levelsCh.id,
                    'levelSystem.leaderboardChannelId': leaderboardCh.id,
                    'levelSystem.leaderboardMessageId': null // Null yap ki bot yeni mesaj atsın
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ Veritabanı güncellendi.');

    } catch (e) {
        console.error('Hata:', e);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

fixChannels();
