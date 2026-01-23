const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jail-setup')
        .setDescription('Hapis sistemini otomatik kurar')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const guildSettings = await Guild.findOrCreate(interaction.guild.id, interaction.guild.name);

        try {
            // 1. Jail Rolü Oluşturma
            let jailRole = interaction.guild.roles.cache.find(r => r.name === 'Hapis');
            if (!jailRole) {
                jailRole = await interaction.guild.roles.create({
                    name: '🚫 Cezalı',
                    color: '#000001', // Neredeyse siyah
                    reason: 'Nexora Jail Setup'
                });
            }

            // 2. Karantina Kategorisi
            let quarantineCategory = interaction.guild.channels.cache.find(
                c => c.name === 'KARANTİNA' && c.type === ChannelType.GuildCategory
            );

            if (!quarantineCategory) {
                quarantineCategory = await interaction.guild.channels.create({
                    name: 'KARANTİNA',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // @everyone görmesin
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: jailRole.id, // Jail rolü görsün
                            allow: [PermissionsBitField.Flags.ViewChannel]
                        }
                    ]
                });
            }

            // 3. Hücre Kanalı
            let cellChannel = interaction.guild.channels.cache.find(
                c => c.name === 'hücre' && c.parentId === quarantineCategory.id
            );

            if (!cellChannel) {
                cellChannel = await interaction.guild.channels.create({
                    name: 'hücre',
                    type: ChannelType.GuildText,
                    parent: quarantineCategory.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: jailRole.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]
                });

                await cellChannel.send('🔒 **Hücre Oluşturuldu.**\nCezalı kullanıcılar sadece burayı görebilir.');
            }

            // 4. Mevcut Kanalları Gizle
            // Bu işlem biraz uzun sürebilir ve API limitine takılabilir ancak en güvenli yöntemdir.
            // Jail rolünün diğer TÜM kanalları görmesini engellememiz lazım.
            // Ancak, "kullanıcıdan tüm rolleri alacağımız için" normalde gerekmez.
            // YİNE DE, @everyone perm'i açıksa görebilirler.
            // Bu yüzden Jail rolüne tüm kanallarda ViewChannel: deny vermek en garantisidir.

            interaction.guild.channels.cache.forEach(async (channel) => {
                if (channel.id !== cellChannel.id && channel.id !== quarantineCategory.id) {
                    try {
                        await channel.permissionOverwrites.edit(jailRole.id, {
                            ViewChannel: false,
                            SendMessages: false,
                            Connect: false
                        });
                    } catch (e) { /* Ignore errors */ }
                }
            });

            // Ayarları kaydet
            guildSettings.jailSystem.roleId = jailRole.id;
            guildSettings.jailSystem.categoryId = quarantineCategory.id;
            guildSettings.jailSystem.channelId = cellChannel.id;
            await guildSettings.save();

            await interaction.editReply({
                embeds: [embeds.success('Kurulum Tamamlandı',
                    `✅ **Hapis Rolü:** ${jailRole}\n` +
                    `✅ **Kategori:** ${quarantineCategory.name}\n` +
                    `✅ **Hücre:** ${cellChannel}\n\n` +
                    `Artık \`/jail\` komutunu kullanabilirsiniz. Hapisteki kişilerin **TÜM ROLLERİ ALINIR** ve sadece hücreyi görebilirler.`
                )]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                embeds: [embeds.error('Hata', `Kurulum sırasında bir hata oluştu: ${error.message}`)]
            });
        }
    }
};
