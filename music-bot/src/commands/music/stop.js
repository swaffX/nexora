const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue, destroyQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setNameLocalizations({ tr: 'durdur' })
        .setDescription('Stop the music and clear the queue')
        .setDescriptionLocalizations({ tr: 'Müziği durdur ve kuyruğu temizle' }),
    cooldown: 3,
    djRequired: true,

    async execute(interaction, client, lang) {
        const queue = await getQueue(client, interaction.guild.id);

        if (!queue) {
            return interaction.reply({
                content: t('noMusic', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
            return interaction.reply({
                content: t('notSameVoice', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        destroyQueue(client, interaction.guild.id);
        return interaction.reply(t('stopped', lang));
    }
};
