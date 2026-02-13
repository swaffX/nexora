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
            // Match System & Lobby Start
            if (customId.startsWith('match_') || customId.startsWith('lobby_')) {
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

            // Lobby Code Submit (Admin Setup)
            if (customId.startsWith('modal_create_match_')) {
                const parts = customId.split('_');
                const lobbyId = parts[3];
                const voiceId = parts[4]; // Artık voiceId modal ID'sinde
                const code = interaction.fields.getTextInputValue('lobby_code');
                const lobby = require('../handlers/match/lobby');
                await lobby.createLobby(interaction, lobbyId, code, voiceId);
            }

            // Tournament System (Opsiyonel - Modül yoksa atla)
            if (customId.startsWith('tour_') || customId.startsWith('modal_tour')) {
                try {
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
                } catch (e) {
                    // Tournament modülü mevcut değilse sessizce geç
                    if (e.code !== 'MODULE_NOT_FOUND') {
                        console.error('Tournament Handler Error:', e);
                    }
                }
            }

            // Control Panel System
            if (customId.startsWith('panel_')) {
                const panelHandler = require('../handlers/panelHandler');
                await panelHandler.handleInteraction(interaction, client);
            }

            // Lobby Toggle (Lobby 2/3 Aç/Kapat)
            if (customId.startsWith('lobby_toggle_')) {
                const lobbyHandler = require('../handlers/lobbyToggleHandler');
                await lobbyHandler.handleToggle(interaction);
            }

            // Leaderboard mode buttons (Top ELO / Win Streak / MVP)
            if (customId.startsWith('lb_mode_') && interaction.isButton()) {
                const leaderboard = require('../handlers/leaderboard');
                await leaderboard.handleModeInteraction(interaction, client);
            }

        } catch (error) {
            logger.error('Custom Bot Interaction Error:', error);
        }
    },
};
