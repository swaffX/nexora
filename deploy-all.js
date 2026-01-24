const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const bots = [
    {
        name: 'main-bot',
        token: process.env.TOKEN,
        clientId: process.env.CLIENT_ID,
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
            await rest.put(
                Routes.applicationGuildCommands(bot.clientId, process.env.GUILD_ID), // Önce sunucuya özel yükle (Hızlı)
                { body: commands }
            );
            console.log(`✅ ${bot.name}: BAŞARILI!`);
        } catch (error) {
            console.error(`❌ ${bot.name} Hatası:`, error);
        }
    }
})();
