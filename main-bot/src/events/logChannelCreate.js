const { EmbedBuilder, ChannelType } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'channelCreate',
    async execute(channel, client) {
        if (!channel.guild) return;

        let channelType = 'Bilinmiyor';
        if (channel.type === ChannelType.GuildText) channelType = 'Yazı Kanalı';
        else if (channel.type === ChannelType.GuildVoice) channelType = 'Ses Kanalı';
        else if (channel.type === ChannelType.GuildCategory) channelType = 'Kategori';
        else if (channel.type === ChannelType.GuildAnnouncement) channelType = 'Duyuru Kanalı';
        else if (channel.type === ChannelType.GuildStageVoice) channelType = 'Sahne Kanalı';
        else if (channel.type === ChannelType.GuildForum) channelType = 'Forum Kanalı';

        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Green
            .setTitle('📺 Kanal Oluşturuldu')
            .addFields(
                { name: 'Kanal Adı', value: `${channel.name}`, inline: true },
                { name: 'Tür', value: channelType, inline: true },
                { name: 'Kategori', value: channel.parent ? channel.parent.name : 'Yok', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${channel.id}` });

        await sendLog(client, channel.guild.id, 'channel', embed);
    }
};
