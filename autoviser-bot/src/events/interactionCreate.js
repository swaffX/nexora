const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Komut çalıştırılırken bir hata oluştu!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Komut çalıştırılırken bir hata oluştu!', ephemeral: true });
            }
        }
    },
};
