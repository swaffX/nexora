const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const bots = [
    { name: 'guard-bot-2' },
    { name: 'guard-bot-3' },
    { name: 'backup-bot' }
];

async function clear() {
    for (const bot of bots) {
        const envPath = path.join(__dirname, bot.name, '.env');
        if (!fs.existsSync(envPath)) continue;

        const envContent = fs.readFileSync(envPath, 'utf8');
        const tokenMatch = envContent.match(/TOKEN=(.*)/);
        const clientMatch = envContent.match(/CLIENT_ID=(.*)/);
        const guildMatch = envContent.match(/GUILD_ID=(.*)/);

        if (!tokenMatch || !clientMatch) continue;

        const token = tokenMatch[1].trim();
        const clientId = clientMatch[1].trim();
        const guildId = guildMatch ? guildMatch[1].trim() : null;

        const rest = new REST({ version: '10' }).setToken(token);

        try {
            console.log(`🗑️ ${bot.name} komutları siliniyor...`);

            // Hem Global hem Sunucu bazlı temizlik yap (Garanti olsun)
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            }

            console.log(`✅ ${bot.name} komutları tamamen silindi.`);
        } catch (error) {
            console.error(`❌ ${bot.name} silme hatası:`, error.message);
        }
    }
}

clear();
