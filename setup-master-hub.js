require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');

const GUILD_ID = process.env.GUILD_ID;

// AYARLAR
const MASTER_CATEGORY_NAME = '🔊 • VOICE MASTER';
const GENERATOR_CHANNEL_NAME = '➕ • Oda Oluştur';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function setupMasterHub() {
    try {
        console.log('🔗 Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('🤖 Bot giriş yapıyor...');
        await client.login(process.env.TOKEN);

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) throw new Error('Sunucu bulunamadı!');

        console.log(`📡 Sunucu: ${guild.name}`);

        // 1. Kategoriyi Kontrol Et / Oluştur
        let category = guild.channels.cache.find(c => c.name === MASTER_CATEGORY_NAME && c.type === ChannelType.GuildCategory);

        if (!category) {
            console.log('📂 Kategori oluşturuluyor...');
            category = await guild.channels.create({
                name: MASTER_CATEGORY_NAME,
                type: ChannelType.GuildCategory
            });
        } else {
            console.log('✅ Kategori zaten var.');
        }

        // 2. Generator Kanalını Kontrol Et / Oluştur
        let generator = guild.channels.cache.find(c => c.name === GENERATOR_CHANNEL_NAME && c.parentId === category.id);

        if (!generator) {
            console.log('🔊 Generator kanalı oluşturuluyor...');
            generator = await guild.channels.create({
                name: GENERATOR_CHANNEL_NAME,
                type: ChannelType.GuildVoice,
                parent: category.id,
                // Herkes görebilir ve girebilir
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                    }
                ]
            });
            console.log(`✨ Kanal ID: ${generator.id}`);
        } else {
            console.log('✅ Generator kanalı zaten var.');
        }

        console.log('\n🎉 Master Voice Hub başarıyla kuruldu!');
        console.log('------------------------------------------------');
        console.log('Kullanıcılar "➕ • Oda Oluştur" kanalına girdiğinde');
        console.log('otomatik olarak kendi odalarına taşınacaklar.');

    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await mongoose.disconnect();
        client.destroy();
        process.exit();
    }
}

setupMasterHub();
