require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { Guild } = require('./shared/models');

// ID'ler
const GUILD_ID = process.env.GUILD_ID;
const IDs = {
    registerLog: '1463875473703436289', // Kayıt odası (Log veya komut kanalı)
    chat: '1463875477377912853',        // Sohbet odası
    welcome: '1463875499414650944',     // Gelenler
    goodbye: '1463875500949639331',     // Gidenler
    memberCount: '1463875502187221106', // Kişi sayacı
    autoRoleLog: '1463875503222948027', // Otorol verilenler

};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function setup() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Veritabanı bağlantısı başarılı.');

        // Ayarları Güncelle
        console.log('Ayarlar kaydediliyor...');
        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            {
                $set: {
                    'register.logChannelId': IDs.registerLog,
                    'register.chatChannelId': IDs.chat,
                    'register.enabled': true,

                    'welcome.channelId': IDs.welcome,
                    'welcome.enabled': true,

                    'goodbye.channelId': IDs.goodbye,
                    'goodbye.enabled': true,

                    'stats.memberCountChannelId': IDs.memberCount,

                    'autoRole.enabled': true,
                    // Otorol log kanalı modelde yoksa logs.moderation veya register.logChannelId kullanılabilir.
                    // Şimdilik logs.member alanına kaydedelim veya register loguna
                    'logs.member': IDs.autoRoleLog,


                }
            },
            { upsert: true, new: true }
        );
        console.log('Veritabanı ayarları güncellendi.');

        // Bot Login
        console.log('Bot başlatılıyor...');
        await client.login(process.env.TOKEN);

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) throw new Error('Sunucu bulunamadı!');



        // Kişi Sayacını Güncelle
        const statsChannel = await guild.channels.fetch(IDs.memberCount);
        if (statsChannel) {
            await statsChannel.setName(`Üye Sayısı: ${guild.memberCount}`).catch(e => console.error('Kanal ismi değiştirilemedi:', e.message));
            console.log('Kişi sayacı güncellendi.');
        }

        console.log('Kurulum tamamlandı!');
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

setup();
