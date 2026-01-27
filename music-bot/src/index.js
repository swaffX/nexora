require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Shared imports
const sharedPath = path.join(__dirname, '..', '..', 'shared');
const database = require(path.join(sharedPath, 'database'));
const logger = require(path.join(sharedPath, 'logger'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.commands = new Collection();
client.cooldowns = new Collection();

// Music queues per guild
client.queues = new Map();

// Load Commands
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
const commands = [];

logger.info(`[Neurovia Music] Komut klasörleri: ${commandFolders.join(', ')}`);

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
                    logger.info(`[Neurovia Music] Yüklendi: ${folder}/${file}`);
                }
            } catch (e) {
                logger.error(`[Neurovia Music] Hata: ${folder}/${file} - ${e.message}`);
            }
        }
    }
}

// Load Events
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

// Start Bot
async function start() {
    try {
        await database.connect(process.env.MONGODB_URI);

        const rest = new REST().setToken(process.env.MUSIC_BOT_TOKEN);

        logger.info(`[Neurovia Music] ${commands.length} slash komut yükleniyor...`);

        // Global commands for multi-guild support
        await rest.put(
            Routes.applicationCommands(process.env.MUSIC_BOT_CLIENT_ID),
            { body: commands }
        );
        logger.success(`[Neurovia Music] Slash komutlar GLOBAL modda yüklendi! (Toplam: ${commands.length})`);

        await client.login(process.env.MUSIC_BOT_TOKEN);

    } catch (error) {
        logger.error('[Neurovia Music] Bot başlatılırken hata:', error);
        process.exit(1);
    }
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('[Neurovia Music] Bot kapatılıyor...');

    // Destroy all voice connections
    for (const [guildId, queue] of client.queues) {
        if (queue.connection) {
            queue.connection.destroy();
        }
    }

    await database.disconnect();
    client.destroy();
    process.exit(0);
});
