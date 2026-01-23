const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otorol')
        .setDescription('Sunucuya katılanlara otomatik rol ver')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Otorol sistemini ayarla')
                .addRoleOption(opt =>
                    opt.setName('rol')
                        .setDescription('Verilecek rol')
                        .setRequired(true))
                .addChannelOption(opt =>
                    opt.setName('log_kanali')
                        .setDescription('Log kanalı (Opsiyonel)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Otorol sistemini kapat'))
        .addSubcommand(sub =>
            sub.setName('bilgi')
                .setDescription('Otorol ayarlarını göster')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildSettings = await Guild.findOrCreate(interaction.guild.id, interaction.guild.name);

        // --- AYARLA ---
        if (subcommand === 'ayarla') {
            const role = interaction.options.getRole('rol');
            const logChannel = interaction.options.getChannel('log_kanali');

            // Botun yetkisi yetiyor mu?
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu rol benim yetkimden yüksekte, veremem.')],
                    ephemeral: true
                });
            }

            guildSettings.autoRole = {
                enabled: true,
                roleId: role.id,
                logChannelId: logChannel ? logChannel.id : null
            };
            await guildSettings.save();

            return interaction.reply({
                embeds: [embeds.success('Otorol Ayarlandı',
                    `✅ **Rol:** ${role}\n` +
                    `📝 **Log Kanalı:** ${logChannel ? logChannel : 'Ayarlanmadı'}\n` +
                    `Artık yeni gelen herkese bu rol verilecek.`
                )]
            });
        }

        // --- KAPAT ---
        if (subcommand === 'kapat') {
            guildSettings.autoRole.enabled = false;
            guildSettings.autoRole.roleId = null;
            guildSettings.autoRole.logChannelId = null;
            await guildSettings.save();

            return interaction.reply({
                embeds: [embeds.warning('Otorol Kapatıldı', 'Artık yeni gelenlere otomatik rol verilmeyecek.')]
            });
        }

        // --- BİLGİ ---
        if (subcommand === 'bilgi') {
            if (!guildSettings.autoRole.enabled) {
                return interaction.reply({
                    embeds: [embeds.error('Kapalı', 'Otorol sistemi şu an kapalı.')],
                    ephemeral: true
                });
            }

            const role = interaction.guild.roles.cache.get(guildSettings.autoRole.roleId);
            const channel = interaction.guild.channels.cache.get(guildSettings.autoRole.logChannelId);

            return interaction.reply({
                embeds: [{
                    color: 0x3498DB,
                    title: 'ℹ️ Otorol Bilgisi',
                    fields: [
                        { name: 'Durum', value: '✅ Aktif', inline: true },
                        { name: 'Rol', value: role ? `${role}` : '⚠️ Rol Bulunamadı', inline: true },
                        { name: 'Log Kanalı', value: channel ? `${channel}` : 'Yok', inline: true }
                    ]
                }]
            });
        }
    }
};
