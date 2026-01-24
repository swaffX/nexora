const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
                logger.command(interaction.user.tag, interaction.commandName, interaction.guild.name);
            } catch (error) {
                logger.error(`Komut Hatası (${interaction.commandName}):`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Bir hata oluştu!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Bir hata oluştu!', ephemeral: true });
                }
            }
        }
    },
};
