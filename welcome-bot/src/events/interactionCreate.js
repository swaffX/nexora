const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Hata!', ephemeral: true });
            }
        }

        // Buttons
        if (interaction.isButton()) {
            // Kayıt Butonu (verify)
            if (interaction.customId === 'verify_user') {
                const verifyHandler = require('../handlers/verifyHandler');
                await verifyHandler.handleVerify(interaction, client);
            }
        }
    },
};
