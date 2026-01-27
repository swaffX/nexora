const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setNameLocalizations({ tr: 'ses' })
        .setDescription('Set the playback volume')
        .setDescriptionLocalizations({ tr: 'Çalma ses seviyesini ayarla' })
        .addIntegerOption(option =>
            option.setName('level')
                .setNameLocalizations({ tr: 'seviye' })
                .setDescription('Volume level (1-100)')
                .setDescriptionLocalizations({ tr: 'Ses seviyesi (1-100)' })
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
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

        const volume = interaction.options.getInteger('level');
        queue.setVolume(volume);

        return interaction.reply(t('volumeSet', lang, { volume }));
    }
};
