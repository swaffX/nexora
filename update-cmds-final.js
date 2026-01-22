const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const bots = [
    { name: 'main-bot', type: 'main' },
    { name: 'guard-bot-1', type: 'none' }, // Kullanıcı isteği: Temizle
    { name: 'guard-bot-2', type: 'none' },
    { name: 'guard-bot-3', type: 'none' },
    { name: 'backup-bot', type: 'none' }
];

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
                delete require.cache[require.resolve(filePath)];
                const cmd = require(filePath);
                if (cmd.data) allCommands.push(cmd.data.toJSON());
            } catch (e) { }
        }
    }
}
loadCommands(commandsPath);

async function update() {
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

        const cmds = bot.type === 'main' ? allCommands : [];

        try {
            console.log(`🔄 ${bot.name}: ${cmds.length} komut yükleniyor...`);
            await rest.put(Routes.applicationCommands(clientId), { body: cmds });
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: cmds });
            }
            console.log(`✅ ${bot.name} tamamlandı.`);
        } catch (e) {
            console.error(e.message);
        }
    }
}

update();
