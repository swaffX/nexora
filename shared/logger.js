const chalk = require('chalk');
const moment = require('moment');
const { WebhookClient, EmbedBuilder } = require('discord.js');

const getTimestamp = () => moment().format('YYYY-MM-DD HH:mm:ss');

// Webhook Client başlatma
let webhookClient = null;
try {
    if (process.env.LOG_WEBHOOK_URL) {
        webhookClient = new WebhookClient({ url: process.env.LOG_WEBHOOK_URL });
    }
} catch (e) {
    console.error('Webhook Client başlatılamadı:', e.message);
}

const sendWebhook = async (level, message, ...args) => {
    if (!webhookClient) return;

    // Argümanları temizle ve string'e çevir
    const details = args.map(arg => {
        if (arg instanceof Error) return arg.stack;
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return arg;
    }).join(' ');

    const colors = {
        error: 0xFF0000, // Kırmızı
        warn: 0xFFA500,  // Turuncu
        guard: 0x9B59B6  // Mor
    };

    try {
        const embed = new EmbedBuilder()
            .setTitle(`System Log: ${level.toUpperCase()}`)
            .setColor(colors[level] || 0x2F3136)
            .setDescription(`**Mesaj:** ${message}`)
            .setFooter({ text: `Nexora Bot • ${getTimestamp()}` });

        if (details) {
            // Detay çok uzunsa kes
            const cleanDetails = details.length > 1000 ? details.substring(0, 1000) + '...' : details;
            embed.addFields({ name: 'Detaylar', value: `\`\`\`js\n${cleanDetails}\n\`\`\`` });
        }

        await webhookClient.send({
            username: 'Nexora Logger',
            avatarURL: 'https://i.imgur.com/AfFp7pu.png', // Opsiyonel logo
            embeds: [embed]
        });
    } catch (err) {
        console.error('Logger Webhook Hatası:', err.message);
    }
};

const logger = {
    info: (message, ...args) => {
        console.log(chalk.blue(`[${getTimestamp()}] [INFO]`), message, ...args);
    },

    success: (message, ...args) => {
        console.log(chalk.green(`[${getTimestamp()}] [SUCCESS]`), message, ...args);
    },

    warn: (message, ...args) => {
        console.log(chalk.yellow(`[${getTimestamp()}] [WARN]`), message, ...args);
        sendWebhook('warn', message, ...args);
    },

    error: (message, ...args) => {
        console.log(chalk.red(`[${getTimestamp()}] [ERROR]`), message, ...args);
        sendWebhook('error', message, ...args);
    },

    debug: (message, ...args) => {
        if (process.env.DEBUG === 'true') {
            console.log(chalk.gray(`[${getTimestamp()}] [DEBUG]`), message, ...args);
        }
    },

    command: (user, command, guild) => {
        console.log(chalk.cyan(`[${getTimestamp()}] [COMMAND]`),
            `${user} used /${command} in ${guild}`);
    },

    guard: (type, message) => {
        console.log(chalk.magenta(`[${getTimestamp()}] [GUARD-${type}]`), message);
        sendWebhook('guard', `[${type}] ${message}`);
    }
};

module.exports = logger;
