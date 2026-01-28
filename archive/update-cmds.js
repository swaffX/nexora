const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Bot Yapılandırması
const bots = [
    { name: 'main-bot', type: 'full' },
    { name: 'guard-bot-1', type: 'guard' },
    { name: 'guard-bot-2', type: 'none' }, // Sıfırla
    { name: 'guard-bot-3', type: 'none' }, // Sıfırla
    { name: 'backup-bot', type: 'none' }    // Sıfırla
];

// Komutları Main Bot'tan oku (Tek kaynak)
const commandsPath = path.join(__dirname, 'main-bot', 'src', 'commands');
const allCommands = [];

function loadCommands(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                // Cache temizle ki en güncel hali gelsin
                delete require.cache[require.resolve(filePath)];
                const cmd = require(filePath);
                if (cmd.data && cmd.execute) {
                    allCommands.push(cmd.data.toJSON());
                }
            } catch (e) {
                console.log(`Komut yükleme hatası (${file}):`, e.message);
            }
        }
    }
}

loadCommands(commandsPath);
console.log(`Toplam ${allCommands.length} komut bulundu.`);

async function update() {
    for (const bot of bots) {
        const envPath = path.join(__dirname, bot.name, '.env');
        if (!fs.existsSync(envPath)) {
            console.log(`⚠️ ${bot.name} .env dosyası yok.`);
            continue;
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const tokenMatch = envContent.match(/TOKEN=(.*)/);
        const clientMatch = envContent.match(/CLIENT_ID=(.*)/);
        const guildMatch = envContent.match(/GUILD_ID=(.*)/);

        if (!tokenMatch || !clientMatch) {
            console.log(`⚠️ ${bot.name} için Token veya Client ID eksik.`);
            continue;
        }

        const token = tokenMatch[1].trim();
        const clientId = clientMatch[1].trim();
        const guildId = guildMatch ? guildMatch[1].trim() : null;

        let commandsToLoad = [];

        if (bot.type === 'full') {
            commandsToLoad = allCommands;
        } else if (bot.type === 'guard') {
            // Sadece Mod ve Güvenlik
            const allowed = ['whitelist', 'blacklist', 'backup', 'jail', 'ban', 'kick', 'mute', 'unmute', 'timeout', 'lock', 'unlock', 'clear', 'nuke'];
            commandsToLoad = allCommands.filter(c => allowed.some(a => c.name.includes(a)));
        } else {
            commandsToLoad = []; // Temizle
        }

        const rest = new REST({ version: '10' }).setToken(token);

        try {
            console.log(`🔄 ${bot.name} güncelleniyor... (${commandsToLoad.length} komut)`);

            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsToLoad });
            } else {
                await rest.put(Routes.applicationCommands(clientId), { body: commandsToLoad });
            }
            console.log(`✅ ${bot.name} Tamamlandı.`);
        } catch (error) {
            console.error(`❌ ${bot.name} Hatası:`, error.message);
        }
    }
}

update();
