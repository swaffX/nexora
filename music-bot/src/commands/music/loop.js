const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setNameLocalizations({ tr: 'döngü' })
        .setDescription('Toggle loop mode')
        .setDescriptionLocalizations({ tr: 'Döngü modunu değiştir' })
        .addStringOption(option =>
            option.setName('mode')
                .setNameLocalizations({ tr: 'mod' })
                .setDescription('Loop mode')
                .setDescriptionLocalizations({ tr: 'Döngü modu' })
                .setRequired(true)
                .addChoices(
                    { name: 'Off / Kapalı', value: 'off' },
                    { name: 'Track / Şarkı', value: 'track' },
                    { name: 'Queue / Kuyruk', value: 'queue' }
                )
        ),
    cooldown: 2,
    djRequired: true,

    async execute(interaction, client, lang) {
        const queue = await getQueue(client, interaction.guild.id);

        if (!queue || !queue.current) {
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

        const mode = interaction.options.getString('mode');
        queue.loop = mode;

        if (mode === 'off') {
            return interaction.reply(t('loopOff', lang));
        } else if (mode === 'track') {
            return interaction.reply(t('loopTrack', lang));
        } else {
            return interaction.reply(t('loopQueue', lang));
        }
    }
};
