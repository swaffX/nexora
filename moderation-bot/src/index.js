const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { connectDatabase } = require(path.join(__dirname, '..', '..', 'shared', 'database'));
const logger = require(path.join(__dirname, '..', '..', 'shared', 'logger'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration // Ban/Kick yetkileri için
    ]
});

client.commands = new Collection();

// Handlers
const fs = require('fs');
const handlersPath = path.join(__dirname, 'handlers');

if (fs.existsSync(handlersPath)) {
    const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));
    for (const file of handlerFiles) {
        require(`./handlers/${file}`)(client);
    }
}

// Database & Login
(async () => {
    await connectDatabase();

    // TOKEN: MODERATION_BOT_TOKEN
    const token = process.env.MODERATION_BOT_TOKEN;
    if (!token) {
        logger.error('MODERATION_BOT_TOKEN bulunamadı! .env dosyasını kontrol et.');
        // process.exit(1); // Şimdilik kapatmayalım, hata versin
    } else {
        await client.login(token);
    }
})();

module.exports = client;
