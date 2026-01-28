const fs = require('fs');
const path = require('path');

const bots = ['main-bot', 'guard-bot-1', 'guard-bot-2', 'guard-bot-3', 'backup-bot'];

const newPresence = `        client.user.setPresence({
            activities: [{ 
                name: 'made by swaff', 
                type: 1, 
                url: 'https://www.twitch.tv/swaffxedits' 
            }],
            status: 'online'
        });`;

bots.forEach(bot => {
    const filePath = path.join(__dirname, bot, 'src', 'events', 'ready.js');
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Regex: client.user.setPresence({ ... }); yapısını yakalar
        const regex = /client\.user\.setPresence\(\s*\{[\s\S]*?\}\s*\);/;

        if (regex.test(content)) {
            content = content.replace(regex, newPresence);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${bot} aktivitesi güncellendi.`);
        } else {
            // Eğer presence bloğu yoksa (guard botlarda bazen olmayabilir), execute sonuna ekle
            // Ama genelde vardır. Yoksa logla.
            console.log(`❌ ${bot} presence bloğu bulunamadı!`);
        }
    } else {
        console.log(`❌ ${bot} ready.js dosyası yok.`);
    }
});
