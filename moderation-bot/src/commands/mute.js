const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, PermissionOverwrites } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const { Penal } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const ms = require('ms');

async function getOrCreateMuteRole(guild) {
    const TARGET_ROLE_ID = '1464180689611129029'; // Kullanıcının Belirttiği ID

    // 1. Önce ID ile bulmaya çalış
    let role = guild.roles.cache.get(TARGET_ROLE_ID);

    // 2. Bulamazsan isme göre ara
    if (!role) {
        role = guild.roles.cache.find(r => r.name === 'Cezalı');
    }

    if (!role) {
        try {
            role = await guild.roles.create({
                name: 'Cezalı',
                color: '#818386', // Gri renk
                permissions: [],
                reason: 'Otomatik Mute Sistemi'
            });

            // Tüm kanallara erişimi engelle (Yazma/Konuşma)
            guild.channels.cache.forEach(async (channel) => {
                await channel.permissionOverwrites.create(role, {
                    SendMessages: false,
                    Speak: false,
                    AddReactions: false,
                    Connect: false // Ses kanalına girmesin
                }).catch(() => { });
            });
        } catch (e) {
            console.error('Cezalı rolü oluşturulamadı:', e);
            throw new Error('Cezalı rolü oluşturulamadı/ayarlanamadı.');
        }
    }
    return role;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Kullanıcıya "Cezalı" rolü verir (Veritabanı Kayıtlı)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Cezalandırılacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('süre')
                .setDescription('Ceza süresi (örn: 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Ceza sebebi')),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const duration = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const { MessageFlags } = require('discord.js');
        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Kullanıcı bulunamadı.')],
                flags: MessageFlags.Ephemeral
            });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıya ceza veremezsiniz.')],
                flags: MessageFlags.Ephemeral
            });
        }

        // Süre Kontrolü
        const durationMs = ms(duration);
        if (!durationMs || durationMs < 1000) {
            const { MessageFlags } = require('discord.js');
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Geçersiz süre formatı (örn: 1h, 30m).')],
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        try {
            // Rol İşlemleri
            const role = await getOrCreateMuteRole(interaction.guild);
            await member.roles.add(role);

            // Veritabanı Kaydı
            const penal = new Penal({
                guildId: interaction.guild.id,
                userId: user.id,
                type: 'MUTE',
                startTime: new Date(),
                endTime: new Date(Date.now() + durationMs),
                reason: reason,
                moderatorId: interaction.user.id,
                active: true
            });
            await penal.save();

            // Native Timeout (Opsiyonel: İkisi birden olsun mu? Evet, ekstra güvenlik)
            try { await member.timeout(durationMs, reason); } catch (e) { }

            await interaction.editReply({
                embeds: [embeds.moderation('Susturma (Cezalı)', user, interaction.user, reason, duration)]
            });

            // DM Bildirim
            try {
                await user.send({
                    embeds: [embeds.warning(
                        'Cezalandırıldınız',
                        `**${interaction.guild.name}** sunucusunda "Cezalı" rolü aldınız.\n**Süre:** ${duration}\n**Sebep:** ${reason}`
                    )]
                });
            } catch (error) { }

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                embeds: [embeds.error('Hata', `İşlem başarısız: ${error.message}`)]
            });
        }
    }
};
