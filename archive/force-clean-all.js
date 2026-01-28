const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './main-bot/.env' });

const TARGET_GUILD_ID = process.env.GUILD_ID || '1069725546600210583';

const bots = [
    { name: 'main-bot', type: 'main' },
    { name: 'guard-bot-1', type: 'none' }, // Kullanıcı Guard 1'i de temizle dediği için 'none'
    { name: 'guard-bot-2', type: 'none' },
    { name: 'guard-bot-3', type: 'none' },
    { name: 'backup-bot', type: 'none' }
];

// Main Botun kalan komutlarını oku
const commandsPath = path.join(__dirname, 'main-bot', 'src', 'commands');
const mainCommands = [];

function loadCommands(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                delete require.cache[require.resolve(filePath)];
                const cmd = require(filePath);
                if (cmd.data) mainCommands.push(cmd.data.toJSON());
            } catch (e) { }
        }
    }
}
loadCommands(commandsPath);

console.log(`Main Bot Komut Sayısı: ${mainCommands.length}`);

async function run() {
    for (const bot of bots) {
        const envPath = path.join(__dirname, bot.name, '.env');
        if (!fs.existsSync(envPath)) continue;

        let envContent = fs.readFileSync(envPath, 'utf8');
        const tokenMatch = envContent.match(/TOKEN=(.*)/);
        const clientMatch = envContent.match(/CLIENT_ID=(.*)/);

        if (!tokenMatch || !clientMatch) continue;

        const token = tokenMatch[1].trim();
        const clientId = clientMatch[1].trim();

        const rest = new REST({ version: '10' }).setToken(token);

        console.log(`🛡️ ${bot.name} işlem görüyor...`);

        try {
            // 1. ÖNCE HER ŞEYİ SİL (Global & Guild)
            // Globali silmeyi dene
            await rest.put(Routes.applicationCommands(clientId), { body: [] }).catch(e => console.log('Global silme hatası:', e.message));

            // Guild'i silmeyi dene
            if (TARGET_GUILD_ID) {
                await rest.put(Routes.applicationGuildCommands(clientId, TARGET_GUILD_ID), { body: [] }).catch(e => console.log('Guild silme hatası:', e.message));
            }

            // 2. EĞER MAIN BOT İSE KALANLARI YÜKLE
            if (bot.type === 'main') {
                console.log(`   📥  ${mainCommands.length} yeni komut yükleniyor...`);
                // Anlık etki için Guild'e yükle
                if (TARGET_GUILD_ID) {
                    await rest.put(Routes.applicationGuildCommands(clientId, TARGET_GUILD_ID), { body: mainCommands });
                    console.log('   ✅  Sunucuya yüklendi.');
                }
            }
            console.log(`✅ ${bot.name} İŞLEM TAMAM.\n`);

        } catch (error) {
            console.error(`❌ ${bot.name} Kritik Hata:`, error.message);
        }
    }
}

run();
