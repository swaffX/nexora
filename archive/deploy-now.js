const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './main-bot/.env' });

const commands = [];
const commandsPath = path.join(__dirname, 'main-bot', 'src', 'commands');

function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[UYARI] ${file} komutunda data veya execute eksik.`);
            }
        }
    }
}

loadCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`Token: ${process.env.TOKEN ? 'OK' : 'YOK'}`);
        console.log(`ClientId: ${process.env.CLIENT_ID}`);
        console.log(`GuildId: ${process.env.GUILD_ID}`);
        console.log('Yüklenecek komutlar:', commands.map(c => c.name).join(', '));

        console.log('Komutlar sunucuya (Guild) yükleniyor...');

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Başarıyla ${data.length} slash komut yüklendi!`);
    } catch (error) {
        console.error('❌ Yükleme hatası:', error);
    }
})();
