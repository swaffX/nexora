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
                if (!interaction.replied) {
                    const { MessageFlags } = require('discord.js');
                    await interaction.reply({ content: 'Hata!', flags: MessageFlags.Ephemeral });
                }
            }
        }

        // Buttons & Menus & Modals
        const customId = interaction.customId;
        if (!customId) return;

        try {
            // Match System
            if (customId.startsWith('match_')) {
                const matchHandler = require('../handlers/matchHandler');
                await matchHandler.handleInteraction(interaction, client);
            }

            // Tournament System
            if (customId.startsWith('tour_') || customId.startsWith('modal_tour')) {
                const tournamentHandler = require('../handlers/tournamentHandler');

                if (interaction.isModalSubmit() && customId === 'modal_tournament_create') {
                    await tournamentHandler.handleSetup(interaction);
                } else if (interaction.isButton()) {
                    // tour_join_ID -> split
                    const parts = customId.split('_');
                    const action = parts[1]; // join, leave, start
                    const tourId = parts[2];

                    if (action === 'join') await tournamentHandler.handleJoin(interaction, tourId);
                    else if (action === 'leave') await tournamentHandler.handleLeave(interaction, tourId);
                    else if (action === 'start') await tournamentHandler.handleStart(interaction, tourId);
                    else if (action === 'finish') await tournamentHandler.handleFinish(interaction, tourId);
                }
            }

        } catch (error) {
            logger.error('Custom Bot Interaction Error:', error);
        }
    },
};
