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
        let parts = []; // parts dizisini tanımladık

        if (interaction.commandName === 'setup-match' || (interaction.customId && interaction.customId.startsWith('match_create'))) {
            action = 'create';
            // Custom ID: match_create_1
            if (interaction.customId) {
                parts = interaction.customId.split('_');
            }
        } else if (interaction.customId) {
            parts = interaction.customId.split('_');
            action = parts[1];
        } else return;

        const ADMIN_ACTIONS = ['create', 'cancel', 'endmatch', 'endlobby', 'reset', 'rematch', 'enddraft', 'randomcap', 'cap', 'captainA', 'captainB'];
        const REQUIRED_ROLE_ID = '1463875325019557920';

        if (ADMIN_ACTIONS.includes(action)) {
            if (!interaction.member.permissions.has('Administrator') && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
                return interaction.reply({ content: '❌ Bu işlemi yapmak için yetkiniz yok!', flags: require('discord.js').MessageFlags.Ephemeral });
            }
        }

        try {
            switch (action) {
                // --- LOBBY ---
                case 'create': {
                    // parts[2] = lobbyId (1, 2, 3)
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`modal_create_match_${parts ? parts[2] : '1'}`)
                        .setTitle('Maç Oluştur');

                    const codeInput = new TextInputBuilder()
                        .setCustomId('lobby_code')
                        .setLabel("Valorant Lobi Kodu (6 Hane)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örn: ABC123')
                        .setMinLength(6)
                        .setMaxLength(6)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
                    await interaction.showModal(modal);
                    break;
                }
                case 'cancel':
                    await lobby.cancelMatch(interaction);
                    break;
                case 'abort':
                    // Ephemeral mesajı veya modalı iptal et
                    // customId: match_abort_...
                    await interaction.update({ content: '❌ İşlem iptal edildi.', components: [] });
                    setTimeout(() => interaction.deleteReply().catch(() => { }), 2000);
                    break;
                case 'captainA': // (Yedek)
                case 'cap': // match_cap_select_A_MATCHID
                    if (parts && parts[2] === 'select') {
                        // parts[3] = Team (A/B), parts[4] = MatchID
                        await lobby.selectCaptain(interaction, parts[3], parts[4]);
                    }
                    break;
                case 'captainB': // (Yedek)
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

                // --- LOBBY CODE ---
                case 'setcode': {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`modal_lobbycode_${parts[2]}`)
                        .setTitle('Valorant Lobi Kodu Gir');

                    const codeInput = new TextInputBuilder()
                        .setCustomId('code_input')
                        .setLabel("6 Haneli Lobi Kodu")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örn: ABC123')
                        .setMinLength(6)
                        .setMaxLength(6)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
                    await interaction.showModal(modal);
                    break;
                }

                case 'endmatch':
                    await game.endMatch(interaction);
                    break;
                // winner case is removed

                // --- SCORE ---
                case 'openscore':
                    await game.openScoreModal(interaction);
                    break;

                case 'rematch':
                    // Takımlar Aynı (Rövanş) -> Direkt Oylama
                    const mRematch = await Match.findOne({ matchId: parts[2] });
                    if (mRematch) await voting.prepareVoting(interaction, mRematch, true);
                    break;
                case 'reset':
                    // Takımları Değiştir -> Lobiye Dön
                    await lobby.resetLobby(interaction);
                    break;
                case 'endlobby':
                    // Lobiyi Bitir -> Sil
                    // Önce yanıt ver, yoksa kanal silinince yanıt verilemez
                    await interaction.reply({ content: '✅ Lobi sonlandırılıyor...', flags: require('discord.js').MessageFlags.Ephemeral });

                    await manager.forceEndMatch(interaction.guild, parts[2], 'Lobi yetkili tarafından sonlandırıldı.');
                    await manager.cleanupVoiceChannels(interaction.guild, await Match.findOne({ matchId: parts[2] })); // Ekstra ses temizliği

                    setTimeout(() => {
                        if (interaction && interaction.channel) interaction.channel.delete().catch(() => { });
                    }, 1000); // Biraz bekle sonra sil
                    break;

                default:
                    // Bilinmeyen buton
                    // console.warn(`Unknown match action: ${action}`);
                    break;
            }
        } catch (error) {
            console.error(`Match Router Error [${action}]:`, error);
            try {
                const { MessageFlags } = require('discord.js');
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', flags: MessageFlags.Ephemeral });
                }
            } catch (e) { }
        }
    },

    // Cron job ve Admin komutları için dışa aktarım
    checkTimeouts: (client) => manager.checkTimeouts(client),
    forceEndMatch: (guild, matchId, reason) => manager.forceEndMatch(guild, matchId, reason)
};
