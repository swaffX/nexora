const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Kullanıcıyı sustur')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Susturulacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('süre')
                .setDescription('Susturma süresi (örn: 1h, 30m, 1d)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Susturma sebebi')),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const duration = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Kullanıcı bulunamadı.')],
                ephemeral: true
            });
        }

        // Yetki kontrolü
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı susturamazsınız.')],
                ephemeral: true
            });
        }

        const durationMs = ms(duration);
        if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Geçersiz süre. Maksimum 28 gün.')],
                ephemeral: true
            });
        }

        try {
            await member.timeout(durationMs, reason);

            await interaction.reply({
                embeds: [embeds.moderation('Susturma', user, interaction.user, reason, duration)]
            });

            // DM gönder
            try {
                await user.send({
                    embeds: [embeds.warning(
                        'Susturuldunuz',
                        `**${interaction.guild.name}** sunucusunda susturuldunuz.\n**Süre:** ${duration}\n**Sebep:** ${reason}`
                    )]
                });
            } catch (error) { }

        } catch (error) {
            await interaction.reply({
                embeds: [embeds.error('Hata', `Susturma başarısız: ${error.message}`)],
                ephemeral: true
            });
        }
    }
};
