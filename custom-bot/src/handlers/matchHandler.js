const path = require('path');
const { Match } = require('../../../shared/models');

// Modüller
const lobby = require('./match/lobby');
const draft = require('./match/draft');
const voting = require('./match/voting');
const game = require('./match/game');
const manager = require('./match/manager');

module.exports = {
    async handleInteraction(interaction, client) {
        let action;
        if (interaction.commandName === 'setup-match' || interaction.customId === 'match_create') action = 'create';
        else if (interaction.customId) {
            const parts = interaction.customId.split('_');
            action = parts[1];
        } else return;

        try {
            switch (action) {
                // --- LOBBY ---
                case 'create':
                    await lobby.createLobby(interaction);
                    break;
                case 'captainA':
                    await lobby.selectCaptain(interaction, 'A');
                    break;
                case 'captainB':
                    await lobby.selectCaptain(interaction, 'B');
                    break;
                case 'randomcap':
                    await lobby.assignRandomCaptains(interaction);
                    break;
                case 'coin':
                    await game.handleCoinFlip(interaction);
                    break;

                // --- DRAFT ---
                case 'pick':
                    await draft.handlePlayerPick(interaction);
                    break;
                case 'refresh':
                    await draft.refreshDraftUI(interaction);
                    break;
                case 'enddraft':
                    // Manuel bitiriş (oyuncu kalmadıysa)
                    const mDraft = await Match.findOne({ matchId: interaction.customId.split('_')[2] });
                    if (mDraft) await voting.prepareVoting(interaction, mDraft, true);
                    break;

                // --- VOTING ---
                case 'vote':
                    await voting.handleMapVote(interaction);
                    break;

                // --- GAME ---
                case 'sidepick':
                    await game.handleSidePick(interaction);
                    break;
                case 'endmatch':
                    await game.endMatch(interaction);
                    break;
                case 'winner':
                    await game.handleMatchResult(interaction);
                    break;

                default:
                    // Bilinmeyen buton
                    // console.warn(`Unknown match action: ${action}`);
                    break;
            }
        } catch (error) {
            console.error(`Match Router Error [${action}]:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    const { MessageFlags } = require('discord.js');
                    await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral });
                }
            } catch (e) { }
        }
    },

    // Cron job ve Admin komutları için dışa aktarım
    checkTimeouts: (client) => manager.checkTimeouts(client),
    forceEndMatch: (guild, matchId, reason) => manager.forceEndMatch(guild, matchId, reason)
};
