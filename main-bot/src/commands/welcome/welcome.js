const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits , MessageFlags } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Hoşgeldin sistemi ayarları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Hoşgeldin sistemini aktifleştir'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Hoşgeldin sistemini devre dışı bırak'))
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Hoşgeldin kanalını ayarla')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Hoşgeldin kanalı')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('Hoşgeldin mesajını ayarla')
                .addStringOption(opt =>
                    opt.setName('mesaj')
                        .setDescription('Mesaj ({user}, {username}, {server}, {membercount})')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Test mesajı gönder')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = await Guild.findOrCreate(interaction.guild.id, interaction.guild.name);

        switch (subcommand) {
            case 'enable': {
                guildSettings.welcome.enabled = true;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Hoşgeldin Sistemi', 'Hoşgeldin sistemi aktifleştirildi!')]
                });
                break;
            }

            case 'disable': {
                guildSettings.welcome.enabled = false;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.warning('Hoşgeldin Sistemi', 'Hoşgeldin sistemi devre dışı bırakıldı!')]
                });
                break;
            }

            case 'channel': {
                const channel = interaction.options.getChannel('kanal');
                guildSettings.welcome.channelId = channel.id;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Ayar Güncellendi', `Hoşgeldin kanalı ${channel} olarak ayarlandı.`)]
                });
                break;
            }

            case 'message': {
                const message = interaction.options.getString('mesaj');
                guildSettings.welcome.message = message;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Ayar Güncellendi', `Hoşgeldin mesajı güncellendi:\n${message}`)]
                });
                break;
            }

            case 'test': {
                if (!guildSettings.welcome.channelId) {
                    return interaction.reply({
                        embeds: [embeds.error('Hata', 'Önce hoşgeldin kanalını ayarlayın.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const channel = interaction.guild.channels.cache.get(guildSettings.welcome.channelId);
                if (!channel) {
                    return interaction.reply({
                        embeds: [embeds.error('Hata', 'Hoşgeldin kanalı bulunamadı.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                await channel.send({
                    embeds: [embeds.welcome(interaction.member, guildSettings.welcome.message, interaction.guild.memberCount)]
                });

                await interaction.reply({
                    embeds: [embeds.success('Test', `Test mesajı ${channel} kanalına gönderildi.`)]
                });
                break;
            }
        }
    }
};
