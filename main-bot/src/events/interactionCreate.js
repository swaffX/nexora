const path = require('path');
const { MessageFlags } = require('discord.js');
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
                const errorMessage = { content: '❌ Komut çalıştırılırken bir hata oluştu!', flags: MessageFlags.Ephemeral };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Autocomplete Handling
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                logger.error('Autocomplete Error:', error);
            }
        }

        // Buton tıklamaları
        if (interaction.isButton()) {
            try {
                const [action, ...args] = interaction.customId.split('_');

                // Tournament Button Handler (tour_join_ID)
                if (action === 'tour') {
                    const tournamentHandler = require('../handlers/tournamentHandler');
                    const [type, tourId] = args; // tour_join_ID -> split -> tour (action), join (args[0]), ID (args[1])
                    // Fix split logic: customId "tour_join_123" -> action="tour", args=["join", "123"]
                    if (args[0] === 'join') await tournamentHandler.handleJoin(interaction, args[1]);
                    if (args[0] === 'leave') await tournamentHandler.handleLeave(interaction, args[1]);
                    return;
                }

                if (action === 'giveaway') {
                    const giveawayHandler = require('../handlers/giveawayHandler');
                    await giveawayHandler.handleButton(interaction, args, client);
                }

                // Control Center
                if (action === 'ctrl') {
                    const controlHandler = require('../handlers/controlHandler');
                    await controlHandler.handleButton(interaction);
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
                const errorMsg = { content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.', flags: MessageFlags.Ephemeral };
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

                if (action === 'voice') {
                    const voiceMasterHandler = require('../handlers/voiceMasterHandler');
                    if (interaction.customId.startsWith('voice_kick_confirm_')) {
                        await voiceMasterHandler.handleKickConfirm(interaction);
                    }
                }

                // match_select_team1 -> action=match
                if (action === 'match') {
                    const matchHandler = require('../handlers/matchHandler');
                    await matchHandler.handleInteraction(interaction, client);
                }

                if (interaction.customId === 'help_menu') {
                    const selected = interaction.values[0];
                    let content = '';

                    if (selected === 'main_commands') content = '🏠 **Ana Komutlar:**\n`/help` - Yardım menüsü\n`/ping` - Bot gecikmesi\n`/vote` - Bota oy ver';
                    if (selected === 'economy_commands') content = '💰 **Ekonomi Sistemi (Tüm Komutlar):**\n__Meslek & Kazanç__\n' +
                        '`/career jobs` - İş ilanlarına bak ve meslek seç (YENİ!)\n' +
                        '`/career work` - Çalış ve maaş/XP kazan\n' +
                        '`/career info` - Kariyer durumunu ve terfi bilgisini gör\n' +
                        '`/daily` - Günlük ödülünü al\n\n' +
                        '__Görevler & Başarımlar__\n' +
                        '`/quests daily` - Günlük görevlerini gör ve yap (YENİ!)\n' +
                        '`/quests achievements` - Kazandığın başarım ve rozetleri gör (YENİ!)\n\n' +
                        '__Finans & Borsa__\n' +
                        '`/crypto market` - Kripto piyasasını gör\n' +
                        '`/crypto chart` - Canlı grafik analizi yap (YENİ!)\n' +
                        '`/crypto buy/sell` - Kripto al veya sat\n' +
                        '`/balance` - Cüzdanını ve banka hesabını gör\n' +
                        '`/transfer` - Arkadaşına para gönder\n\n' +
                        '__Şans Oyunları & Kumar__\n' +
                        '`/horserace` - At yarışı oyna (Canlı İzleme)\n' +
                        '`/coinflip` - Yazı tura at (2x)\n' +
                        '`/roulette` - Rulet oyna (Renk/Sayı)\n' +
                        '`/slots` - Slot makinesini çevir\n' +
                        '`/blackjack` - Blackjack oyna (21)\n' +
                        '`/duel` - Başkasıyla bahisli düello at\n\n' +
                        '__Eşya & Yönetim__\n' +
                        '`/market` - Marketten eşya/pet al\n' +
                        '`/inventory` - Çantanı görüntüle\n' +
                        '`/pets` - Hayvanlarını yönet';
                    if (selected === 'match_commands') content = '⚔️ **5v5 & Turnuva:**\n`/setup-match` - Maç paneli (Admin)\n`/bet` - Maç bahsi yap\n`/tournament` - Turnuva işlemleri';
                    if (selected === 'level_commands') content = '📈 **Seviye Sistemi:**\n`/profile` - Profilini gör\n`/leaderboard` - Sıralama';
                    if (selected === 'user_commands') content = '👤 **Kullanıcı:**\n`/avatar` - Avatarını gör\n`/banner` - Bannerını gör\n`/profil` - Gelişmiş profil';

                    await interaction.reply({ content: content, flags: MessageFlags.Ephemeral });
                }
            } catch (error) {
                logger.error('Select menu interaction hatası:', error);
                const errorMsg = { content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.', flags: MessageFlags.Ephemeral };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMsg).catch(() => { });
                } else {
                    await interaction.reply(errorMsg).catch(() => { });
                }
            }
        }

        // Modal Submit GLOBAL HANDLER
        if (interaction.isModalSubmit()) {
            try {
                // CASINO MODAL HANDLER
                if (interaction.customId.startsWith('casino_modal_')) {
                    const commandName = interaction.customId.replace('casino_modal_', '');
                    const command = client.commands.get(commandName);

                    if (command) {
                        try {
                            const fields = interaction.fields;

                            // Interaction'ı 'sanki slash command gibi' modifiye et
                            // Orijinal interaction'ı bozmadan, execute fonksiyonuna
                            // 'options' özelliğini inject ediyoruz.
                            // Ancak JS objeleri referansla geçtiği için dikkatli olmalıyız.
                            // En güvenli yol: Proxy kullanmak veya execute fonksiyonunun options'ı okuyan kısmını
                            // overwrite etmek. Basitçe interaction'a options metodlarını ekleyelim.

                            interaction.options = {
                                getString: (name) => {
                                    try { return fields.getTextInputValue(name); } catch (e) { return null; }
                                },
                                getInteger: (name) => {
                                    try {
                                        const val = fields.getTextInputValue(name);
                                        return val ? parseInt(val) : null;
                                    } catch (e) { return null; }
                                },
                                getUser: () => interaction.user,
                                getMember: () => interaction.member,
                                get: (name) => { return { value: fields.getTextInputValue(name) }; } // Genel get
                            };

                            await command.execute(interaction, client);
                            logger.command(interaction.user.tag, `MODAL:${commandName}`, interaction.guild?.name);
                        } catch (err) {
                            logger.error('Casino Modal Error:', err);
                            await interaction.reply({ content: '❌ Oyun başlatılamadı: ' + err.message, flags: MessageFlags.Ephemeral });
                        }
                    } else {
                        await interaction.reply({ content: '❌ Oyun bulunamadı.', flags: MessageFlags.Ephemeral });
                    }
                    return; // Casino modal işlemi bitti
                }

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
    }
};
