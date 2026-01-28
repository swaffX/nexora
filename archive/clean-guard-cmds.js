const fs = require('fs');
const path = require('path');

const bots = ['guard-bot-1', 'guard-bot-2', 'guard-bot-3', 'backup-bot'];
const rootDir = __dirname; // c:\Users\zeyne\OneDrive\Masaüstü\nexora

bots.forEach(botName => {
    const commandsDir = path.join(rootDir, botName, 'src', 'commands');

    if (fs.existsSync(commandsDir)) {
        console.log(`Cleaning commands for ${botName}...`);

        // Klasör içindeki dosyaları sil
        fs.readdirSync(commandsDir).forEach(file => {
            const curPath = path.join(commandsDir, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                fs.rmSync(curPath, { recursive: true, force: true });
                console.log(`  Deleted folder: ${file}`);
            } else {
                fs.unlinkSync(curPath);
                console.log(`  Deleted file: ${file}`);
            }
        });

        console.log(`✅ ${botName} commands cleaned.`);
    } else {
        console.log(`⚠️ ${botName} commands directory not found.`);
    }
});
