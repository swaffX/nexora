const { Client, GatewayIntentBits, Collection, Options } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require(path.join(__dirname, '..', '..', 'shared', 'database'));
const logger = require(path.join(__dirname, '..', '..', 'shared', 'logger'));
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates // Ses kanalı takibi için şart
    ],
    // WebSocket ayarları (bağlantı sorunları için)
    ws: {
        large_threshold: 250
    },
    // Cache optimizasyonu
    makeCache: Options.cacheWithLimits({
        MessageManager: 200,
        PresenceManager: 0,
        GuildMemberManager: {
            maxSize: 200,
            keepOverLimit: member => member.id === client.user?.id
        }
    })
});

client.commands = new Collection();

// Handlers
const fs = require('fs');
const handlersPath = path.join(__dirname, 'handlers');

// Command Handler
const commandsPath = path.join(__dirname, 'commands');
const { REST, Routes } = require('discord.js');

// Recursive fonksiyon: alt klasörlerdeki komutları da yükler
function loadCommandsRecursive(dir, commands = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Alt klasör ise recursive çağır
            loadCommandsRecursive(filePath, commands);
        } else if (file.endsWith('.js')) {
            // JS dosyası ise komutu yükle
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }
    }
    return commands;
}

async function loadCommands() {
    let commands = [];
    if (fs.existsSync(commandsPath)) {
        commands = loadCommandsRecursive(commandsPath);
    }

    if (process.env.CUSTOM_BOT_TOKEN && process.env.CUSTOM_CLIENT_ID) {
        const rest = new REST().setToken(process.env.CUSTOM_BOT_TOKEN);
        try {
            logger.info('[Custom] Komutlar yükleniyor...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.CUSTOM_CLIENT_ID, process.env.GUILD_ID), // Sadece bu sunucuda
                { body: commands }
            );
            logger.success('[Custom] Komutlar yüklendi!');
        } catch (error) {
            logger.error('[Custom] Komut yükleme hatası:', error.message);
        }
    }
}

// Event Handler
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(`./events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

// Main
(async () => {
    const mongoURI = process.env.MONGODB_URI;
    if (mongoURI) {
        await db.connect(mongoURI);
    } else {
        logger.error('MONGODB_URI bulunamadı!');
    }

    await loadCommands();

    const token = process.env.CUSTOM_BOT_TOKEN;
    if (!token) {
        logger.error('CUSTOM_BOT_TOKEN bulunamadı!');
    } else {
        // Retry mekanizması ile login
        let retries = 0;
        const maxRetries = 5;
        
        const attemptLogin = async () => {
            try {
                await client.login(token);
                logger.success('[Custom] Bot başarıyla giriş yaptı!');
                
                // Arka Plan Rank Sistemi (5 Saniyede bir otomatik tarama)
                require('./autoRankSystem')(client);
            } catch (error) {
                retries++;
                if (retries < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
                    logger.warn(`[Custom] Bağlantı hatası (${retries}/${maxRetries}). ${delay/1000}s sonra tekrar denenecek...`);
                    logger.error(`[Custom] Hata detayı: ${error.message}`);
                    setTimeout(attemptLogin, delay);
                } else {
                    logger.error('[Custom] Maksimum deneme sayısına ulaşıldı. Bot başlatılamadı.');
                    logger.error('[Custom] Hata:', error);
                    process.exit(1);
                }
            }
        };
        
        await attemptLogin();
    }
})();

// Hata Yakalama
process.on('unhandledRejection', (reason, p) => {
    logger.error('[Custom] Unhandled Rejection:', reason);
    // Discord bağlantı hatalarında otomatik yeniden başlatma
    if (reason?.message?.includes('Unexpected server response')) {
        logger.warn('[Custom] Discord bağlantı hatası tespit edildi. 10 saniye sonra yeniden başlatılıyor...');
        setTimeout(() => {
            process.exit(1); // PM2 otomatik restart yapacak
        }, 10000);
    }
});

process.on('uncaughtException', (err) => {
    logger.error('[Custom] Uncaught Exception:', err);
    // Kritik hatalarda yeniden başlat
    if (err?.message?.includes('ECONNRESET') || err?.message?.includes('ETIMEDOUT')) {
        logger.warn('[Custom] Ağ hatası tespit edildi. 10 saniye sonra yeniden başlatılıyor...');
        setTimeout(() => {
            process.exit(1);
        }, 10000);
    }
});

module.exports = client;
