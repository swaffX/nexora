const fs = require('fs');
const path = require('path');

const bots = ['main-bot', 'guard-bot-1', 'guard-bot-2', 'guard-bot-3', 'backup-bot'];
const VOICE_CHANNEL_ID = '1463921161925558485';

const joinCode = `
        // Auto Join Voice
        try {
            const { joinVoiceChannel } = require('@discordjs/voice');
            const channel = client.channels.cache.get('${VOICE_CHANNEL_ID}');
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true
                });
                console.log('🔊 Bot ses kanalına giriş yaptı.');
            }
        } catch (e) {
            console.log('Ses bağlantı hatası (Modül eksik olabilir):', e.message);
        }
`;

bots.forEach(bot => {
    const filePath = path.join(__dirname, bot, 'src', 'events', 'ready.js');
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('joinVoiceChannel')) {
            console.log(`${bot} zaten sese girme koduna sahip.`);
        } else {
            const regex = /client\.user\.setPresence\(\s*\{[\s\S]*?\}\s*\);/;
            const match = content.match(regex);

            if (match) {
                const presenceBlock = match[0];
                const newContent = content.replace(presenceBlock, presenceBlock + '\n' + joinCode);
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`✅ ${bot} ses kodu eklendi.`);
            } else {
                console.log(`❌ ${bot} presence bloğu bulunamadı, kod eklenemedi.`);
            }
        }
    }
});
