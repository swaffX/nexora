require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, AuditLogEvent } = require('discord.js');
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
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildModeration
    ]
});

client.commands = new Collection();

// Anti-nuke için cache'ler
client.actionCache = new Map();   // Kullanıcı eylemleri

// Komutları yükle
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
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
            // Çift komut oluşumunu engellemek için önce Global komutları temizle
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.success('Slash komutlar SUNUCU modunda yüklendi (Global temizlendi)!');
        } else {
            
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.success('Slash komutlar SUNUCU modunda yüklendi (Anında Erişim)!');
        } else {
            
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.success('Slash komutlar SUNUCU modunda yüklendi (Anında Erişim)!');
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            logger.success('Slash komutlar GLOBAL modda yüklendi (Önbellek süresi olabilir)!');
        }
        }
        }

        await client.login(process.env.TOKEN);

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
