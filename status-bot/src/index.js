const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require(path.join(__dirname, '..', '..', 'shared', 'database'));
const logger = require(path.join(__dirname, '..', '..', 'shared', 'logger'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// --- COMMAND HANDLER ---
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const items = fs.readdirSync(commandsPath);
    for (const item of items) {
        const itemPath = path.join(commandsPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(itemPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                }
            }
        } else if (item.endsWith('.js')) {
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

// --- EVENT HANDLER ---
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

// Database & Login
(async () => {
    const mongoURI = process.env.MONGODB_URI;
    if (mongoURI) {
        await db.connect(mongoURI);
    } else {
        logger.error('MONGODB_URI bulunamadı!');
    }

    const token = process.env.STATUS_BOT_TOKEN;
    if (!token) {
        logger.error('STATUS_BOT_TOKEN bulunamadı! .env dosyasını kontrol et.');
    } else {
        await client.login(token);
    }
})();

module.exports = client;
