const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setNameLocalizations({ tr: 'temizle' })
        .setDescription('Clear the queue')
        .setDescriptionLocalizations({ tr: 'Kuyruğu temizle' }),
    cooldown: 3,
    djRequired: true,

    async execute(interaction, client, lang) {
        const queue = await getQueue(client, interaction.guild.id);

        if (!queue || !queue.tracks.length) {
            return interaction.reply({
                content: t('queueEmpty', lang),
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

        queue.clear();
        return interaction.reply(t('cleared', lang));
    }
};
