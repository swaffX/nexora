const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { MusicGuild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setNameLocalizations({ tr: 'ayarlar' })
        .setDescription('Configure music bot settings')
        .setDescriptionLocalizations({ tr: 'Müzik botu ayarlarını yapılandır' })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('dj')
                .setDescription('Set DJ role')
                .setDescriptionLocalizations({ tr: 'DJ rolünü ayarla' })
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setNameLocalizations({ tr: 'rol' })
                        .setDescription('DJ role (leave empty to clear)')
                        .setDescriptionLocalizations({ tr: 'DJ rolü (temizlemek için boş bırakın)' })
                )
        )
        .addSubcommand(sub =>
            sub.setName('volume')
                .setNameLocalizations({ tr: 'ses' })
                .setDescription('Set default volume')
                .setDescriptionLocalizations({ tr: 'Varsayılan ses seviyesini ayarla' })
                .addIntegerOption(opt =>
                    opt.setName('level')
                        .setNameLocalizations({ tr: 'seviye' })
                        .setDescription('Default volume (1-100)')
                        .setDescriptionLocalizations({ tr: 'Varsayılan ses seviyesi (1-100)' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100)
                )
        )
        .addSubcommand(sub =>
            sub.setName('announce')
                .setNameLocalizations({ tr: 'bildirim' })
                .setDescription('Toggle now playing announcements')
                .setDescriptionLocalizations({ tr: 'Şarkı bildirimlerini aç/kapat' })
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setNameLocalizations({ tr: 'aktif' })
                        .setDescription('Enable announcements?')
                        .setDescriptionLocalizations({ tr: 'Bildirimleri aktif et?' })
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('autoleave')
                .setNameLocalizations({ tr: 'otomatikayrıl' })
                .setDescription('Set auto-leave timeout')
                .setDescriptionLocalizations({ tr: 'Otomatik ayrılma süresini ayarla' })
                .addIntegerOption(opt =>
                    opt.setName('minutes')
                        .setNameLocalizations({ tr: 'dakika' })
                        .setDescription('Minutes to wait (1-30)')
                        .setDescriptionLocalizations({ tr: 'Beklenecek dakika (1-30)' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(30)
                )
        )
        .addSubcommand(sub =>
            sub.setName('language')
                .setNameLocalizations({ tr: 'dil' })
                .setDescription('Set bot language')
                .setDescriptionLocalizations({ tr: 'Bot dilini ayarla' })
                .addStringOption(opt =>
                    opt.setName('lang')
                        .setNameLocalizations({ tr: 'dil' })
                        .setDescription('Language')
                        .setDescriptionLocalizations({ tr: 'Dil' })
                        .setRequired(true)
                        .addChoices(
                            { name: 'Türkçe', value: 'tr' },
                            { name: 'English', value: 'en' }
                        )
                )
        ),
    cooldown: 3,
    djRequired: false,

    async execute(interaction, client, lang) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = await MusicGuild.getOrCreate(interaction.guild.id);

        switch (subcommand) {
            case 'dj': {
                const role = interaction.options.getRole('role');
                guildSettings.djRoleId = role ? role.id : null;
                await guildSettings.save();

                if (role) {
                    return interaction.reply(t('djRoleSet', lang, { role: `<@&${role.id}>` }));
                } else {
                    return interaction.reply(t('djRoleCleared', lang));
                }
            }

            case 'volume': {
                const volume = interaction.options.getInteger('level');
                guildSettings.defaultVolume = volume;
                await guildSettings.save();

                return interaction.reply(t('volumeDefault', lang, { volume }));
            }

            case 'announce': {
                const enabled = interaction.options.getBoolean('enabled');
                guildSettings.announceNowPlaying = enabled;
                await guildSettings.save();

                return interaction.reply(enabled ? t('announceOn', lang) : t('announceOff', lang));
            }

            case 'autoleave': {
                const minutes = interaction.options.getInteger('minutes');
                guildSettings.autoLeaveMinutes = minutes;
                await guildSettings.save();

                return interaction.reply(t('autoLeaveSet', lang, { minutes }));
            }

            case 'language': {
                const newLang = interaction.options.getString('lang');
                guildSettings.language = newLang;
                await guildSettings.save();

                return interaction.reply(newLang === 'tr' ? '✅ Dil Türkçe olarak ayarlandı!' : '✅ Language set to English!');
            }
        }
    }
};
