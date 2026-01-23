const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Slash komutları
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
                logger.command(interaction.user.tag, interaction.commandName, interaction.guild?.name || 'DM');
            } catch (error) {
                logger.error(`Komut hatası: ${interaction.commandName}`, error);
                const errorMessage = { content: '❌ Komut çalıştırılırken bir hata oluştu!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Buton tıklamaları
        if (interaction.isButton()) {
            try {
                const [action, ...args] = interaction.customId.split('_');

                if (action === 'giveaway') {
                    const giveawayHandler = require('../handlers/giveawayHandler');
                    await giveawayHandler.handleButton(interaction, args, client);
                }

                // verify_user -> action=verify
                if (action === 'verify') {
                    const verifyHandler = require('../handlers/verifyHandler');
                    await verifyHandler.handleButton(interaction, args, client);
                }

                // match_create, match_end -> action=match
                if (action === 'match') {
                    const matchHandler = require('../handlers/matchHandler');
                    await matchHandler.handleInteraction(interaction, client);
                }

                if (action === 'voice') {
                    const voiceMasterHandler = require('../handlers/voiceMasterHandler');
                    await voiceMasterHandler.handleInteraction(interaction, client);
                }

                // ticket_create_support -> action=ticket
                if (action === 'ticket') {
                    const ticketHandler = require('../handlers/ticketHandler');
                    await ticketHandler.handleInteraction(interaction);
                }
            } catch (error) {
                logger.error('Button interaction hatası:', error);
                const errorMsg = { content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMsg).catch(() => { });
                } else {
                    await interaction.reply(errorMsg).catch(() => { });
                }
            }
        }

        // Select menu (String ve User dahil hepsi)
        if (interaction.isAnySelectMenu()) {
            try {
                const [action, ...args] = interaction.customId.split('_');

                if (action === 'reactionrole') {
                    const reactionRoleHandler = require('../handlers/reactionRoleHandler');
                    await reactionRoleHandler.handleSelect(interaction, args, client);
                }

                // match_select_team1 -> action=match
                if (action === 'match') {
                    const matchHandler = require('../handlers/matchHandler');
                    await matchHandler.handleInteraction(interaction, client);
                }

                if (interaction.customId === 'help_menu') {
                    const selected = interaction.values[0];
                    let content = '';

                    if (selected === 'main_commands') content = '🏠 **Ana Komutlar:**\n`/help` - Yardım menüsü\n`/ping` - Bot gecikmesi';
                    if (selected === 'economy_commands') content = '💰 **Ekonomi Sistemi:**\n`/daily` - Günlük ödül\n`/work` - Çalış ve para kazan\n`/slots` - Slot oyunu\n`/coinflip` - Yazı tura\n`/balance` - Bakiyeni gör\n`/transfer` - Para gönder\n`/deposit` - Bankaya yatır\n`/withdraw` - Bankadan çek';
                    if (selected === 'match_commands') content = '⚔️ **5v5 & Turnuva:**\n`/setup-match` - Maç paneli (Admin)\n`/bet` - Maç bahsi yap\n`/tournament` - Turnuva işlemleri';
                    if (selected === 'level_commands') content = '📈 **Seviye Sistemi:**\n`/profile` - Profilini gör\n`/leaderboard` - Sıralama';
                    if (selected === 'user_commands') content = '👤 **Kullanıcı:**\n`/avatar` - Avatarını gör\n`/banner` - Bannerını gör\n`/profil` - Gelişmiş profil';

                    await interaction.reply({ content: content, ephemeral: true });
                }
            } catch (error) {
                logger.error('Select menu interaction hatası:', error);
                const errorMsg = { content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMsg).catch(() => { });
                } else {
                    await interaction.reply(errorMsg).catch(() => { });
                }
            }
        }

        // Modal Submit
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId.startsWith('modal_voice_')) {
                    const voiceMasterHandler = require('../handlers/voiceMasterHandler');
                    await voiceMasterHandler.handleModal(interaction);
                }

                if (interaction.customId === 'modal_tournament_create') {
                    const tournamentHandler = require('../handlers/tournamentHandler');
                    await tournamentHandler.handleSetup(interaction);
                }
            } catch (error) {
                logger.error('Modal interaction hatası:', error);
            }
        }

        // Tournament Button Handler (Extra check since we are inside button block mostly)
        // Note: Better to move this into the main isButton block, but adding here for safety if missed
        if (interaction.isButton() && interaction.customId.startsWith('tour_')) {
            try {
                const tournamentHandler = require('../handlers/tournamentHandler');
                const [action, type, tourId] = interaction.customId.split('_'); // tour_join_ID

                if (type === 'join') await tournamentHandler.handleJoin(interaction, tourId);
                if (type === 'leave') await tournamentHandler.handleLeave(interaction, tourId);
            } catch (e) { console.error(e); }
        }
    }
};
