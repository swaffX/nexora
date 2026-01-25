require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Shared imports - path.join ile
const sharedPath = path.join(__dirname, '..', '..', 'shared');
const database = require(path.join(sharedPath, 'database'));
const logger = require(path.join(sharedPath, 'logger'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.GuildMember]
});

client.commands = new Collection();
client.cooldowns = new Collection();

// XP cooldown cache
client.xpCooldowns = new Map();
// Invite cache
client.inviteCache = new Map();
// Voice session cache
client.voiceSessions = new Map();
// Giveaway cache
client.giveaways = new Map();

// Komutları yükle
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
const commands = [];

logger.info(`Taranan klasörler: ${commandFolders.join(', ')}`);

for (const folder of commandFolders) {
    const commandsPath = path.join(__dirname, 'commands', folder);
    const stat = fs.statSync(commandsPath);

    if (stat.isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    // logger.info(`Yüklendi: ${folder}/${file}`);
                } else {
                    logger.warn(`⚠️ [EKSİK] ${folder}/${file} komutunda data veya execute yok.`);
                }
            } catch (e) {
                logger.error(`❌ [HATA] ${folder}/${file} yüklenemedi: ${e.message}`);
            }
        }
    } else if (commandsPath.endsWith('.js')) {
        const command = require(commandsPath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

// Eventleri yükle
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Bot başlatma
async function start() {
    try {
        await database.connect(process.env.MONGODB_URI);

        const rest = new REST().setToken(process.env.TOKEN);

        logger.info(`${commands.length} slash komut yükleniyor...`);


        if (process.env.GUILD_ID) {
            // Çift komut oluşumunu engellemek için önce Global komutları temizle (isteğe bağlı, development için iyi)
            // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.success(`Slash komutlar SUNUCU modunda yüklendi! (Toplam: ${commands.length})`);
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            logger.success(`Slash komutlar GLOBAL modda yüklendi! (Toplam: ${commands.length})`);
        }

        await client.login(process.env.TOKEN);

        // Kripto Döngüsünü Başlat


        // Gece 00:00 Görev Sıfırlama Döngüsü
        setInterval(async () => {
            const now = new Date();
            // Sunucu saati ile 00:00 kontrolü (Basit Cron)
            // Daha kesin olması için dakika değişikliğini takip edebiliriz ama 60sn interval yeterli.
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                logger.info('🌙 Gece 00:00 -> Günlük görevler sıfırlanıyor...');
                const User = require(path.join(sharedPath, 'models', 'User'));

                // Tüm kullanıcıların görevlerini sil (Lazy Loading için)
                // Kullanıcı herhangi bir komut kullandığında yeni görevler atanacak.
                try {
                    await User.updateMany({}, {
                        quests: [],
                        lastQuestReset: null // Null yap ki "Tarih değişikliği" algılansın
                    });
                    logger.success('✅ Tüm kullanıcıların görevleri temizlendi. Giriş yaptıkça yenilenecek.');
                } catch (err) {
                    logger.error('Görev sıfırlama hatası:', err);
                }
            }
        }, 60000); // Her dakika 1 kere çalışır

    } catch (error) {
        logger.error('Bot başlatılırken hata:', error);
        process.exit(1);
    }
}

start();

process.on('SIGINT', async () => {
    logger.info('Bot kapatılıyor...');
    await database.disconnect();
    client.destroy();
    process.exit(0);
});
