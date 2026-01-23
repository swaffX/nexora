const path = require('path');
const { Guild, Starboard } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user, client) {
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                return;
            }
        }
        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            const guildSettings = await Guild.findOne({ odaId: reaction.message.guild.id });
            if (!guildSettings || !guildSettings.starboard?.enabled) return;

            const sbSettings = guildSettings.starboard;
            if (reaction.emoji.name !== sbSettings.emoji) return;

            const sbData = await Starboard.findOne({ originalMessageId: reaction.message.id });
            if (!sbData) return; // Henüz panoda yoksa bir şey yapma

            const starChannel = reaction.message.guild.channels.cache.get(sbSettings.channelId);
            if (!starChannel) return;

            const starMsg = await starChannel.messages.fetch(sbData.starboardMessageId).catch(() => null);

            // Eşik değerin altına düştü mü?
            if (reaction.count < sbSettings.threshold) {
                // Sil
                if (starMsg) await starMsg.delete();
                await Starboard.deleteOne({ _id: sbData._id });
            } else {
                // Güncelle
                if (starMsg) {
                    const starMsgContent = `${sbSettings.emoji} **${reaction.count}** | <#${reaction.message.channel.id}>`;
                    await starMsg.edit({ content: starMsgContent });
                    sbData.starCount = reaction.count;
                    await sbData.save();
                }
            }

        } catch (error) {
            console.error('[Starboard Remove] Hata:', error);
        }
    }
};
