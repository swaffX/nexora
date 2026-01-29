const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Sunucuyu kilitler veya kilidi açar (Acil Durum)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Sunucuyu kilitler (Herkesin yazmasını engeller)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('Sunucu kilidini açar')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (subcommand === 'start') {
            await interaction.deferReply();

            const channels = guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
            let lockedCount = 0;

            for (const [, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false
                    });
                    lockedCount++;
                } catch (e) {
                    console.error(`Kanal kilitlenemedi ${channel.name}:`, e);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 LOCKDOWN AKTİF')
                .setDescription(`⚠️ **ACİL DURUM PROTOKOLÜ** ⚠️\n\nSunucu geçici olarak kilitlenmiştir.\nToplam **${lockedCount}** kanal kapatıldı.\nLütfen yetkililerden haber bekleyin.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else if (subcommand === 'end') {
            await interaction.deferReply();

            const channels = guild.channels.cache.filter(c => c.isTextBased() && c.manageable);
            let unlockedCount = 0;

            for (const [, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null, // Varsayılana döndür
                        AddReactions: null
                    });
                    unlockedCount++;
                } catch (e) {
                    console.error(`Kanal açılamadı ${channel.name}:`, e);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ LOCKDOWN SONLANDI')
                .setDescription(`Güvenlik tehdidi geçti. Sunucu tekrar kullanıma açıldı.\nToplam **${unlockedCount}** kanal açıldı.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
