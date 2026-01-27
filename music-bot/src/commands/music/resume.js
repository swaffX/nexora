const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setNameLocalizations({ tr: 'devam' })
        .setDescription('Resume the paused song')
        .setDescriptionLocalizations({ tr: 'Duraklatılmış şarkıya devam et' }),
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

        if (!queue.paused) {
            return interaction.reply({
                content: '▶️ Müzik zaten çalıyor!',
                flags: MessageFlags.Ephemeral
            });
        }

        queue.resume();
        return interaction.reply(t('resumed', lang));
    }
};
