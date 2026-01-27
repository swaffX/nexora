const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setNameLocalizations({ tr: 'kaldır' })
        .setDescription('Remove a song from the queue')
        .setDescriptionLocalizations({ tr: 'Kuyruktan şarkı kaldır' })
        .addIntegerOption(option =>
            option.setName('position')
                .setNameLocalizations({ tr: 'sıra' })
                .setDescription('Position in queue (1, 2, 3...)')
                .setDescriptionLocalizations({ tr: 'Kuyruktaki sıra (1, 2, 3...)' })
                .setRequired(true)
                .setMinValue(1)
        ),
    cooldown: 2,
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

        const position = interaction.options.getInteger('position');
        const removed = queue.remove(position - 1);

        if (!removed) {
            return interaction.reply({
                content: t('removeInvalid', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply(t('removed', lang, { title: removed.title }));
    }
};
