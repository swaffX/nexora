const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getQueue } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setNameLocalizations({ tr: 'geç' })
        .setDescription('Skip to the next song')
        .setDescriptionLocalizations({ tr: 'Sonraki şarkıya geç' }),
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

        const skippedTitle = queue.current.title;
        queue.skip();
        return interaction.reply(t('skipped', lang) + ` **${skippedTitle}**`);
    }
};
