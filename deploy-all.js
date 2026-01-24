const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Main Bot Token Kontrolü (Ana .env veya main-bot/.env)
let mainToken = process.env.TOKEN;
let mainClientId = process.env.CLIENT_ID;

if (!mainToken) {
    const mainEnvPath = path.join(__dirname, 'main-bot', '.env');
    if (fs.existsSync(mainEnvPath)) {
        console.log('📝 Main Bot için yerel .env okunuyor...');
        const content = fs.readFileSync(mainEnvPath, 'utf8');
        // Basit regex
        const tokenMatch = content.match(/TOKEN=(.*)/);
        const idMatch = content.match(/CLIENT_ID=(.*)/);
        if (tokenMatch) mainToken = tokenMatch[1].trim();
        if (idMatch) mainClientId = idMatch[1].trim();
    }
}

const bots = [
    {
        name: 'main-bot',
        token: mainToken,
        clientId: mainClientId,
        path: path.join(__dirname, 'main-bot', 'src', 'commands')
    },
    {
        name: 'moderation-bot',
        token: process.env.MODERATION_BOT_TOKEN,
        clientId: process.env.MODERATION_CLIENT_ID,
        path: path.join(__dirname, 'moderation-bot', 'src', 'commands')
    },
    {
        name: 'welcome-bot',
        token: process.env.WELCOME_BOT_TOKEN,
        clientId: process.env.WELCOME_CLIENT_ID,
        path: path.join(__dirname, 'welcome-bot', 'src', 'commands')
    },
    {
        name: 'custom-bot',
        token: process.env.CUSTOM_BOT_TOKEN,
        clientId: process.env.CUSTOM_CLIENT_ID,
        path: path.join(__dirname, 'custom-bot', 'src', 'commands')
    },
    {
        name: 'supervisor-bot',
        token: process.env.SUPERVISOR_BOT_TOKEN,
        clientId: process.env.SUPERVISOR_CLIENT_ID,
        path: path.join(__dirname, 'supervisor-bot', 'src', 'commands')
    },
    {
        name: 'status-bot',
        token: process.env.STATUS_BOT_TOKEN,
        clientId: process.env.STATUS_CLIENT_ID,
        path: path.join(__dirname, 'status-bot', 'src', 'commands')
    }
];

function loadCommands(dir) {
    let commands = [];
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            commands = [...commands, ...loadCommands(filePath)];
        } else if (file.endsWith('.js')) {
            try {
                delete require.cache[require.resolve(filePath)];
                const cmd = require(filePath);
                if (cmd.data && cmd.execute) {
                    commands.push(cmd.data.toJSON());
                }
            } catch (e) {
                console.error(`Hata (${filePath}):`, e.message);
            }
        }
    }
    return commands;
}

(async () => {
    console.log('🚀 Komut dağıtımı başlatılıyor...');

    for (const bot of bots) {
        if (!bot.token || !bot.clientId) {
            console.log(`⚠️  ${bot.name} için TOKEN veya CLIENT_ID eksik. Atlanıyor.`);
            continue;
        }

        const commands = loadCommands(bot.path);
        const rest = new REST({ version: '10' }).setToken(bot.token);

        console.log(`🔄 ${bot.name}: ${commands.length} komut bulundu. Yükleniyor...`);

        try {
            // Önce Global'i temizle (Opsiyonel, çakışmayı önler)
            // await rest.put(Routes.applicationCommands(bot.clientId), { body: [] });

            // Sunucuya Yükle
            const targetGuildId = process.env.GUILD_ID || '1069725546600210583'; // Fallback ID
            await rest.put(
                Routes.applicationGuildCommands(bot.clientId, targetGuildId),
                { body: commands }
            );
            console.log(`✅ ${bot.name}: BAŞARILI!`);
        } catch (error) {
            console.error(`❌ ${bot.name} Hatası:`, error);
        }
    }
})();
