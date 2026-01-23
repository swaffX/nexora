const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seviye-sistemi')
        .setDescription('Seviye sistemi ayarlarını yönet')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Sistemi aç/kapat')
                .addBooleanOption(opt =>
                    opt.setName('durum')
                        .setDescription('Açık mı kapalı mı?')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('log-kanal')
                .setDescription('Level atlama log kanalını ayarla')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Log kanalı')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('xp-çarpanı')
                .setDescription('XP kazanma çarpanını ayarla')
                .addNumberOption(opt =>
                    opt.setName('çarpan')
                        .setDescription('Örn: 1.5, 2.0')
                        .setMinValue(0.1)
                        .setMaxValue(10.0)
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = await Guild.findOrCreate(interaction.guild.id, interaction.guild.name);

        if (subcommand === 'ayarla') {
            const status = interaction.options.getBoolean('durum');
            guildSettings.levelSystem.enabled = status;
            await guildSettings.save();

            return interaction.reply({
                embeds: [embeds.success('Başarılı', `Seviye sistemi ${status ? 'aktif edildi' : 'devre dışı bırakıldı'}.`)]
            });
        }

        if (subcommand === 'log-kanal') {
            const channel = interaction.options.getChannel('kanal');
            guildSettings.levelSystem.logChannelId = channel.id;
            await guildSettings.save();

            return interaction.reply({
                embeds: [embeds.success('Başarılı', `Level log kanalı ${channel} olarak ayarlandı.`)]
            });
        }

        if (subcommand === 'xp-çarpanı') {
            const multiplier = interaction.options.getNumber('çarpan');
            guildSettings.levelSystem.multiplier = multiplier;
            await guildSettings.save();

            return interaction.reply({
                embeds: [embeds.success('Başarılı', `XP çarpanı **${multiplier}x** olarak ayarlandı.`)]
            });
        }
    }
};
