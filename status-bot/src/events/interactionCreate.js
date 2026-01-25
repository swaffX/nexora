const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Komut Hatası:', error);
            if (interaction.replied || interaction.deferred) {
                const { MessageFlags } = require('discord.js');
                await interaction.followUp({ content: 'Bir hata oluştu!', flags: MessageFlags.Ephemeral });
            } else {
                const { MessageFlags } = require('discord.js');
                await interaction.reply({ content: 'Bir hata oluştu!', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
```
