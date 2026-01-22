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

                if (action === 'ticket') {
                    const ticketHandler = require('../handlers/ticketHandler');
                    await ticketHandler.handleButton(interaction, args, client);
                }

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

                if (action === 'ticketcategory') {
                    const ticketHandler = require('../handlers/ticketHandler');
                    await ticketHandler.handleSelect(interaction, args, client);
                }

                if (action === 'reactionrole') {
                    const reactionRoleHandler = require('../handlers/reactionRoleHandler');
                    await reactionRoleHandler.handleSelect(interaction, args, client);
                }

                // match_select_team1 -> action=match
                if (action === 'match') {
                    const matchHandler = require('../handlers/matchHandler');
                    await matchHandler.handleInteraction(interaction, client);
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
    }
};
