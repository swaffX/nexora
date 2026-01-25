const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

        module.exports = {
            name: 'interactionCreate',
            async execute(interaction, client) {
                if (!interaction.isChatInputCommand()) return;

                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction, client);
                    logger.command(interaction.user.tag, interaction.commandName, interaction.guild?.name || 'DM');
                } catch (error) {
                    logger.error(`Komut hatası: ${interaction.commandName}`, error);

                    const { MessageFlags } = require('discord.js');
                    const errorMessage = {
                        content: '❌ Komut çalıştırılırken bir hata oluştu!',
                        flags: MessageFlags.Ephemeral
                    };

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                }
            }
        };
