const fs = require('fs');
const path = require('path');

const bots = ['guard-bot-1', 'guard-bot-2', 'guard-bot-3', 'main-bot', 'backup-bot'];

const newCodeBlock = `        if (process.env.GUILD_ID) {
            // Çift komut oluşumunu engellemek için önce Global komutları temizle
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.success('Slash komutlar SUNUCU modunda yüklendi (Global temizlendi)!');
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            logger.success('Slash komutlar GLOBAL modda yüklendi (Önbellek süresi olabilir)!');
        }`;

async function fixBots() {
    for (const bot of bots) {
        const filePath = path.join(__dirname, bot, 'src', 'index.js');

        let content = fs.readFileSync(filePath, 'utf8');

        // Daha esnek regex
        const regex = /if\s*\(process\.env\.GUILD_ID\)[\s\S]*?GLOBAL modda yüklendi.*?\);\s*}/;

        if (regex.test(content)) {
            content = content.replace(regex, newCodeBlock);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`${bot} çift komut sorunu için düzeltildi.`);
        } else {
            // Bir ihtimal indentation sorunu varsa, replace string kullanmadan manuel replace deneyelim
            // Ama regex calismazsa o da calismaz.
            console.log(`${bot} regex yinede uymadı! manuel bakınız.`);
        }
    }
}

fixBots();
