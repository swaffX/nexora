const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require(path.join(__dirname, '..', '..', 'shared', 'database'));
const logger = require(path.join(__dirname, '..', '..', 'shared', 'logger'));
// Custom Discord.js Voice Fix
try {
    const { generateDependencyReport } = require('@discordjs/voice');
    logger.info(generateDependencyReport());
} catch (e) { }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates // Ses kanalı takibi için şart
    ]
});

client.commands = new Collection();

// Handlers
const fs = require('fs');
const handlersPath = path.join(__dirname, 'handlers');

// Command Handler
const commandsPath = path.join(__dirname, 'commands');
const { REST, Routes } = require('discord.js');

async function loadCommands() {
    const commands = [];
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }
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
    const sodium = require('libsodium-wrappers');
    await sodium.ready;

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
        await client.login(token);
    }
})();

module.exports = client;
