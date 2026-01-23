const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { User, Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Kullanıcıyı hapse at veya çıkar')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub =>
            sub.setName('at')
                .setDescription('Kullanıcıyı hapse at')
                .addUserOption(opt =>
                    opt.setName('kullanıcı')
                        .setDescription('Hapse atılacak kullanıcı')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('süre')
                        .setDescription('Hapis süresi (örn: 1h, 30m, 1d) - Boş bırakılırsa süresiz'))
                .addStringOption(opt =>
                    opt.setName('sebep')
                        .setDescription('Hapis sebebi')))
        .addSubcommand(sub =>
            sub.setName('çıkar')
                .setDescription('Kullanıcıyı hapisten çıkar')
                .addUserOption(opt =>
                    opt.setName('kullanıcı')
                        .setDescription('Hapisten çıkarılacak kullanıcı')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep Belirtilmedi';
        const durationInput = interaction.options.getString('süre');

        const guildSettings = await Guild.findOne({ odaId: interaction.guild.id });
        if (!guildSettings || !guildSettings.jailSystem?.roleId) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Jail sistemi kurulu değil. Lütfen önce `/jail-setup` yapın.')],
                ephemeral: true
            });
        }

        const jailRoleId = guildSettings.jailSystem.roleId;
        const cellChannelId = guildSettings.jailSystem.channelId;
        const cellChannel = interaction.guild.channels.cache.get(cellChannelId);

        // Üyeyi bul
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Kullanıcı sunucuda bulunamadı.')],
                ephemeral: true
            });
        }

        // Veritabanı kaydı
        const userData = await User.findOrCreate(targetUser.id, interaction.guild.id, targetUser.username);

        // --- JAIL AT ---
        if (subcommand === 'at') {
            if (member.roles.cache.has(jailRoleId)) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Bu kullanıcı zaten hapiste.')],
                    ephemeral: true
                });
            }

            // Yetki kontrolü
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Sizden eşit veya yüksek yetkili birini hapse atamazsınız.')],
                    ephemeral: true
                });
            }

            // Süre Hesaplama
            let jailedUntil = null;
            let durationText = 'Süresiz';

            if (durationInput) {
                const milliseconds = ms(durationInput);
                if (milliseconds) {
                    jailedUntil = new Date(Date.now() + milliseconds);
                    durationText = durationInput;
                } else {
                    return interaction.reply({
                        embeds: [embeds.error('Hata', 'Geçersiz süre formatı. Örnek: 1h, 30m, 1d')],
                        ephemeral: true
                    });
                }
            }

            // Rolleri kaydet (Bot rolleri ve @everyone hariç)
            const oldRoles = member.roles.cache
                .filter(r => !r.managed && r.name !== '@everyone' && r.id !== jailRoleId)
                .map(r => r.id);

            userData.jail = {
                isJailed: true,
                roles: oldRoles,
                jailedAt: new Date(),
                jailedUntil: jailedUntil,
                reason: reason
            };
            await userData.save();

            // Rollerini al ve Hapis rolünü ver
            try {
                await member.roles.remove(oldRoles);
                await member.roles.add(jailRoleId);

                // Ses kanalındaysa at
                if (member.voice.channel) {
                    await member.voice.disconnect();
                }

                // DM Bilgilendirme
                try {
                    await targetUser.send({
                        embeds: [embeds.error('Hapse Atıldınız',
                            `**${interaction.guild.name}** sunucusunda hapse atıldınız.\n` +
                            `**Süre:** ${durationText}\n` +
                            `**Sebep:** ${reason}\n\n` +
                            `Sadece hücre kanalını görebilirsiniz.`
                        )]
                    });
                } catch (e) { }

                // HÜCRE KANALINA BİLDİRİM
                if (cellChannel) {
                    cellChannel.send({
                        content: `<@${targetUser.id}>`,
                        embeds: [{
                            color: 0xE74C3C,
                            title: '⛓️ HAPİSHANEYE HOŞ GELDİN',
                            description: `Cezalı: <@${targetUser.id}>\nYetkili: <@${interaction.user.id}>`,
                            fields: [
                                { name: 'Süre', value: durationText, inline: true },
                                { name: 'Tahliye', value: jailedUntil ? `<t:${Math.floor(jailedUntil.getTime() / 1000)}:R>` : 'Belirsiz', inline: true },
                                { name: 'Sebep', value: reason, inline: false }
                            ],
                            thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) }
                        }]
                    });
                }

                return interaction.reply({
                    embeds: [embeds.success('Kullanıcı Hapse Atıldı',
                        `🚫 **${targetUser.tag}** hapse atıldı.\n` +
                        `⏱️ **Süre:** ${durationText}\n` +
                        `📋 **Sebep:** ${reason}\n` +
                        `🔒 **Alınan Roller:** ${oldRoles.length} adet`
                    )]
                });

            } catch (error) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', `Rol değişikliği sırasında hata oluştu: ${error.message}`)],
                    ephemeral: true
                });
            }
        }

        // --- JAIL ÇIKAR ---
        if (subcommand === 'çıkar') {
            if (!userData.jail.isJailed && !member.roles.cache.has(jailRoleId)) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Bu kullanıcı hapiste değil.')],
                    ephemeral: true
                });
            }

            const rolesToRestore = userData.jail.roles || [];

            userData.jail = {
                isJailed: false,
                roles: [],
                jailedAt: null,
                jailedUntil: null,
                reason: null
            };
            await userData.save();

            try {
                await member.roles.remove(jailRoleId);

                // Rolleri geri ver
                if (rolesToRestore.length > 0) {
                    await member.roles.add(rolesToRestore);
                }

                if (cellChannel) {
                    cellChannel.send({
                        embeds: [{
                            color: 0x2ECC71,
                            description: `🔓 <@${targetUser.id}> serbest bırakıldı.`
                        }]
                    });
                }

                return interaction.reply({
                    embeds: [embeds.success('Kullanıcı Hapisten Çıkarıldı',
                        `✅ **${targetUser.tag}** özgür bırakıldı.\n` +
                        `🔄 **İade Edilen Roller:** ${rolesToRestore.length} adet`
                    )]
                });

            } catch (error) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', `Rol geri yükleme sırasında hata oluştu: ${error.message}`)],
                    ephemeral: true
                });
            }
        }
    }
};
