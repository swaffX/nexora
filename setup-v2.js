require('dotenv').config({ path: './main-bot/.env' });
const mongoose = require('mongoose');
const { Guild } = require('./shared/models');

// Kullanıcının verdiği yeni ID'ler
const GUILD_ID = process.env.GUILD_ID;
const REGISTER_CHANNEL_ID = '1463875473703436289'; // Kayıt ve Hoşgeldin Kanalı
const UNREGISTERED_ROLE_ID = '1463875341553635553'; // Girişte verilen & kayıtta alınan
const MEMBER_ROLE_ID = '1463875340513317089';       // Kayıtta verilen

async function setupV2() {
    try {
        console.log('Veritabanına bağlanılıyor...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Ayarlar sıfırlanıp yeniden yapılandırılıyor...');

        await Guild.findOneAndUpdate(
            { odaId: GUILD_ID },
            {
                $set: {
                    // 1. Temizlik (Eski modülleri kapat)
                    'goodbye.enabled': false,
                    'stats.memberCountChannelId': null,


                    // 2. Welcome Ayarı (Kayıt Kanalına Mesaj)
                    'welcome.enabled': true,
                    'welcome.channelId': REGISTER_CHANNEL_ID,
                    'welcome.message': '{user} hoşgeldin! Seninle beraber **{memberCount}** kişiyiz.',

                    // 3. Otorol (Girene verilecek rol)
                    'autoRole.enabled': true,
                    'autoRole.roleId': UNREGISTERED_ROLE_ID,
                    'autoRole.logChannelId': null, // Log istenmedi

                    // 4. Kayıt Sistemi
                    'register.enabled': true,
                    'register.logChannelId': REGISTER_CHANNEL_ID, // İşlem sonucunu da buraya yazsın
                    'register.chatChannelId': null, // Sohbet mesajı isteği kaldırıldı veya kayıt kanalına yazılacak

                    // Roller
                    'register.unregisteredRoleId': UNREGISTERED_ROLE_ID, // Alınacak
                    'register.registeredRoleId': MEMBER_ROLE_ID,         // Verilecek

                    // Tek tip rol (Erkek/Kadın ayrımı olmadan aynı rolü ver)
                    'register.maleRoleId': MEMBER_ROLE_ID,
                    'register.femaleRoleId': MEMBER_ROLE_ID
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ Yeni yapılandırma tamamlandı.');
        console.log(`- Hoşgeldin Kanalı: ${REGISTER_CHANNEL_ID}`);
        console.log(`- Otorol: ${UNREGISTERED_ROLE_ID}`);
        console.log(`- Kayıt Rolü: ${MEMBER_ROLE_ID}`);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

setupV2();
