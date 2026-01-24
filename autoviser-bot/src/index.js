const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require(path.join(__dirname, '..', '..', 'shared', 'database'));
const logger = require(path.join(__dirname, '..', '..', 'shared', 'logger'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Command Handler
const fs = require('fs');
const commandsPath = path.join(__dirname, 'commands');

// Klasör yoksa oluştur (Deploy sırasında hata vermemesi için)
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath, { recursive: true });

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Event Handler
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
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
}

// Database & Login
(async () => {
    // DB
    const mongoURI = process.env.MONGODB_URI;
    if (mongoURI) await db.connect(mongoURI);

    // LOGIN
    const token = process.env.AUTOVISER_BOT_TOKEN;
    if (!token) {
        logger.error('AUTOVISER_BOT_TOKEN bulunamadı! .env dosyasını kontrol et.');
    } else {
        await client.login(token);
    }
})();

module.exports = client;
