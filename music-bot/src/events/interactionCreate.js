const { Events, MessageFlags } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { MusicGuild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { t, getLang } = require('../locales');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            // Get guild language
            const guildSettings = await MusicGuild.getOrCreate(interaction.guild.id);
            const lang = guildSettings.language || 'tr';

            // DJ Role Check
            if (command.djRequired && guildSettings.djRoleId) {
                const member = interaction.member;
                if (!member.roles.cache.has(guildSettings.djRoleId) && !member.permissions.has('Administrator')) {
                    return interaction.reply({
                        content: t('djOnly', lang),
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // Cooldown check
            const { cooldowns } = client;
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Map());
            }

            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const cooldownAmount = (command.cooldown || 3) * 1000;

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                    return interaction.reply({
                        content: t('cooldown', lang, { time: timeLeft }),
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            // Execute command with language context
            await command.execute(interaction, client, lang);

        } catch (error) {
            logger.error(`[Neurovia Music] Komut hatası (${interaction.commandName}):`, error);

            const errorMsg = { content: '❌ Bir hata oluştu!', flags: MessageFlags.Ephemeral };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg).catch(() => { });
            } else {
                await interaction.reply(errorMsg).catch(() => { });
            }
        }
    }
};
