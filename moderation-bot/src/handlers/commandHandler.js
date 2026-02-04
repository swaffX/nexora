const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = async (client) => {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');

    // Klasör yoksa oluştur
    if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath, { recursive: true });

    const readCommands = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                readCommands(filePath);
            } else if (file.endsWith('.js')) {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                } else {
                    logger.warn(`[Moderation] ${file} dosyasında data veya execute eksik.`);
                }
            }
        }
    };

    readCommands(commandsPath);

    if (process.env.MODERATION_BOT_TOKEN && process.env.MODERATION_CLIENT_ID) {
        const rest = new REST().setToken(process.env.MODERATION_BOT_TOKEN);
        try {
            logger.info(`[Moderation] ${commands.length} komut yükleniyor...`);
            await rest.put(
                Routes.applicationCommands(process.env.MODERATION_CLIENT_ID),
                { body: commands }
            );
            logger.success(`[Moderation] Komutlar başarıyla yüklendi!`);
        } catch (error) {
            logger.error(`[Moderation] Komut yükleme hatası: ${error.message}`);
        }
    } else {
        logger.warn('[Moderation] Token veya Client ID eksik, slash komutlar güncellenmedi.');
    }
};
