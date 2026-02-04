const { Events } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const gameHandler = require('../handlers/match/game');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;

        // Sadece Resim Varsa İşlem Yap
        if (message.attachments.size === 0) return;

        try {
            // Mesajın atıldığı kanal bir maç kanalı mı?
            // Durumu FINISHING (Skor girilmiş, SS bekleniyor) olan bir maç var mı?
            const match = await Match.findOne({ channelId: message.channel.id, status: 'FINISHING' });

            if (!match) return;

            // Güvenlik: Sadece Kaptanlar, Host veya Yönetici SS atabilir
            const isAuthorized =
                message.author.id === match.hostId ||
                message.author.id === match.captainA ||
                message.author.id === match.captainB ||
                message.member.permissions.has('Administrator');

            if (!isAuthorized) return;

            // SS/Evidence sistemi şu an aktif değil
            // TODO: completeMatchWithEvidence fonksiyonu implemente edilmeli
            // await gameHandler.completeMatchWithEvidence(message, match);

            await message.react('✅'); // SS alındı onayı

        } catch (error) {
            console.error('SS Handler Error:', error);
        }
    },
};
