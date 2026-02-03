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
                try {
                    const { MessageFlags } = require('discord.js');
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Hata!', flags: MessageFlags.Ephemeral });
                    } else if (interaction.deferred) {
                        await interaction.editReply({ content: 'Hata!' });
                    }
                } catch (e) { /* Sessizce geç */ }
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

            // Score Modal Submit
            if (customId.startsWith('modal_score_')) {
                const game = require('../handlers/match/game');
                await game.handleScoreSubmit(interaction);
            }

            // Lobby Code Submit
            if (customId.startsWith('modal_lobbycode_')) {
                const manager = require('../handlers/match/manager');
                await manager.handleLobbyCodeSubmit(interaction);
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
