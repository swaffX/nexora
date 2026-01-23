const path = require('path');
const { Guild, Starboard } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        // Kısmi verileri tamamla
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[Starboard] Mesaj fetch edilemedi:', error);
                return;
            }
        }
        if (user.partial) await user.fetch();

        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            const guildSettings = await Guild.findOne({ odaId: reaction.message.guild.id });
            if (!guildSettings || !guildSettings.starboard?.enabled) return;

            const sbSettings = guildSettings.starboard;

            // Emoji kontrolü
            if (reaction.emoji.name !== sbSettings.emoji) return;

            // Kendi mesajına atma kontrolü
            if (reaction.message.author.id === user.id) {
                // İsterseniz engelleyebilirsiniz, şimdilik serbest
            }

            // Sayı kontrolü
            if (reaction.count < sbSettings.threshold) return;

            const starChannel = reaction.message.guild.channels.cache.get(sbSettings.channelId);
            if (!starChannel) return;

            // Veritabanı kontrolü (Daha önce atıldı mı?)
            let sbData = await Starboard.findOne({ originalMessageId: reaction.message.id });

            const jumpUrl = reaction.message.url;
            const content = reaction.message.content || '[Görsel/Ek]';
            const attachment = reaction.message.attachments.first() ? reaction.message.attachments.first().url : null;
            const author = reaction.message.author;

            const embed = new EmbedBuilder()
                .setColor('#FFAC33') // Altın sarısı
                .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
                .setDescription(`${content}\n\n[MESAJA GİT](${jumpUrl})`)
                .setFooter({ text: `ID: ${reaction.message.id}` })
                .setTimestamp(reaction.message.createdAt);

            if (attachment) embed.setImage(attachment);

            const starMsgContent = `${sbSettings.emoji} **${reaction.count}** | <#${reaction.message.channel.id}>`;

            if (sbData) {
                // Güncelle
                const starMsg = await starChannel.messages.fetch(sbData.starboardMessageId).catch(() => null);
                if (starMsg) {
                    await starMsg.edit({ content: starMsgContent, embeds: [embed] });
                    sbData.starCount = reaction.count;
                    await sbData.save();
                }
            } else {
                // Yeni Oluştur
                const msg = await starChannel.send({ content: starMsgContent, embeds: [embed] });
                await Starboard.create({
                    originalMessageId: reaction.message.id,
                    starboardMessageId: msg.id,
                    channelId: reaction.message.channel.id,
                    odaId: reaction.message.guild.id,
                    authorId: author.id,
                    starCount: reaction.count,
                    content: content,
                    attachments: attachment ? [attachment] : []
                });
            }

        } catch (error) {
            console.error('[Starboard] Hata:', error);
        }
    }
};
