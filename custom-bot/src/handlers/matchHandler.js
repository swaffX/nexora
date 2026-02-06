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
                case 'start': { // lobby_start_ID_VOICEID
                    const lobbyNum = parts[2] || '1';
                    const voiceId = parts[3];

                    // Ses Kanalı Kontrolü (Eğer voiceId varsa zorunlu)
                    if (voiceId) {
                        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== voiceId) {
                            return interaction.reply({
                                content: `❌ Lütfen önce **Lobi ${lobbyNum} Bekleme** ses kanalına (<#${voiceId}>) katılın!`,
                                flags: require('discord.js').MessageFlags.Ephemeral
                            });
                        }
                    }

                    // Modal Aç
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`modal_create_match_${lobbyNum}_${voiceId}`) // VoiceID eklendi
                        .setTitle(`Lobi ${lobbyNum}: Maç Oluştur`);

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
                case 'rps':
                    // RPS sistemi kaldırıldı - artık kullanılmıyor
                    break;
                case 'coin':
                    // Coin sistem kaldırıldı - artık kullanılmıyor
                    break;
                case 'draftcoin':
                    await lobby.handleDraftCoinFlip(interaction);
                    break;
                case 'autobalance':
                    await lobby.handleAutoBalance(interaction);
                    break;
                case 'priority':
                    await lobby.handleDraftPriorityChoice(interaction);
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
                case 'side': // match_side_ATTACK_MATCHID
                    // parts[2] = ATTACK/DEFEND, parts[3] = MATCHID
                    const matchIdForSide = parts[3];
                    const matchForSide = await Match.findOne({ matchId: matchIdForSide });
                    if (matchForSide) {
                        await game.handleSideSelection(interaction, matchForSide, parts[2]);
                    }
                    break;

                case 'sidepick': // Eski kalıntı, belki silinebilir ama dursun
                    // await game.handleSidePick(interaction); 
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

                case 'cancel': { // match_cancel_MATCHID
                    const mCancel = await Match.findOne({ matchId: parts[2] });
                    if (!mCancel) return interaction.reply({ content: 'Maç bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });

                    // Yetki Kontrolü: Host, Admin veya Yetkili Rol
                    const REQUIRED_ROLE_ID = '1463875325019557920';
                    const isHost = interaction.user.id === mCancel.hostId;
                    const isAdmin = interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator);
                    const hasRole = interaction.member.roles.cache.has(REQUIRED_ROLE_ID);

                    if (!isHost && !isAdmin && !hasRole) {
                        return interaction.reply({ content: '❌ Bu işlemi sadece Maç Sahibi veya Yetkili yapabilir.', flags: require('discord.js').MessageFlags.Ephemeral });
                    }

                    await interaction.reply({ content: '🚫 Maç iptal ediliyor...', flags: require('discord.js').MessageFlags.Ephemeral });

                    // Force End (Cleanup + Delete Channel)
                    await manager.forceEndMatch(interaction.guild, mCancel.matchId, `İptal eden: ${interaction.user.username}`);

                    // Metin Kanalını Manuel Sil (Manager silmezse diye garanti)
                    if (interaction.channel) {
                        setTimeout(() => interaction.channel.delete().catch(() => { }), 2000);
                    }
                    break;
                }

                case 'endmatch':
                    await game.endMatch(interaction);
                    break;
                // winner case is removed

                // --- SCORE & MVP ---
                case 'prefinish': // match_prefinish_MATCHID
                    const mPre = await Match.findOne({ matchId: parts[2] });
                    if (mPre) await game.preFinishMatch(interaction, mPre);
                    break;

                case 'score':
                    const mScore = await Match.findOne({ matchId: parts[2] });
                    if (mScore) await game.openScoreModal(interaction, mScore);
                    break;

                case 'openscore': // Legacy/Backup
                case 'enterscore': // Legacy
                case 'selectmvp':
                    // Bu butonlar artık kullanılmıyor olabilir ama eski mesajlar için winner MVP aç
                    const mScoreLegacy = await Match.findOne({ matchId: parts[2] });
                    if (mScoreLegacy) await game.openScoreModal(interaction, mScoreLegacy); // Direkt modal aç
                    break;

                case 'mvp':
                    // match_mvp_winner_MATCHID -> parts: ['match', 'mvp', 'winner', 'ID']
                    // match_mvp_loser_MATCHID
                    const mvpAction = parts[2];
                    const matchMvpId = parts[3];

                    const matchMvp = await Match.findOne({ matchId: matchMvpId });

                    if (matchMvp) {
                        if (mvpAction === 'winner') await game.handleWinnerMVP(interaction, matchMvp);
                        else if (mvpAction === 'loser') await game.handleLoserMVP(interaction, matchMvp);
                        else console.warn('Unknown MVP action:', mvpAction); // Legacy/bilinmeyen action
                    }
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
