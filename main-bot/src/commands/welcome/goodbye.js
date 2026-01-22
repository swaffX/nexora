const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goodbye')
        .setDescription('Görüşürüz sistemi ayarları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Görüşürüz sistemini aktifleştir'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Görüşürüz sistemini devre dışı bırak'))
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Görüşürüz kanalını ayarla')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Görüşürüz kanalı')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('message')
                .setDescription('Görüşürüz mesajını ayarla')
                .addStringOption(opt =>
                    opt.setName('mesaj')
                        .setDescription('Mesaj ({username}, {server})')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = await Guild.findOrCreate(interaction.guild.id, interaction.guild.name);

        switch (subcommand) {
            case 'enable': {
                guildSettings.goodbye.enabled = true;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Görüşürüz Sistemi', 'Görüşürüz sistemi aktifleştirildi!')]
                });
                break;
            }

            case 'disable': {
                guildSettings.goodbye.enabled = false;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.warning('Görüşürüz Sistemi', 'Görüşürüz sistemi devre dışı bırakıldı!')]
                });
                break;
            }

            case 'channel': {
                const channel = interaction.options.getChannel('kanal');
                guildSettings.goodbye.channelId = channel.id;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Ayar Güncellendi', `Görüşürüz kanalı ${channel} olarak ayarlandı.`)]
                });
                break;
            }

            case 'message': {
                const message = interaction.options.getString('mesaj');
                guildSettings.goodbye.message = message;
                await guildSettings.save();
                await interaction.reply({
                    embeds: [embeds.success('Ayar Güncellendi', `Görüşürüz mesajı güncellendi:\n${message}`)]
                });
                break;
            }
        }
    }
};
