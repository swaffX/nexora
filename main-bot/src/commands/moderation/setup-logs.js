const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const AUTHORIZED_ROLE_ID = '1463875325019557920'; // Match yönetim rolü (Bunu kullanıcının isteğine göre güncellemek gerekebilir, log kurulumu için genelde admin yetkisi istenir ama kullanıcı "bu rol harici hiçbir rol yönetemicek" dediği için setup-match için dediğini varsayıyorum. Log kurulumu için de aynı rolü veya sadece Admin'i kullanabiliriz. Güvenlik için Administrator Permission check'i koyup, ek olarak rol kontrolü yapabiliriz.)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-logs')
        .setDescription('Otomatik log kanallarını kurar ve yapılandırır')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Log kurulumu kritik bir işlem olduğu için Administrator yetkisi zaten zorunlu kılındı (Builder'da).
        // Kullanıcının belirttiği rol "setup-match" içindi, ancak tutarlılık adına burada da kontrol edebiliriz veya sadece admin yetkisi yeterli diyebiliriz. 
        // Kullanıcı "1463875325019557920 id'li rol setup-match'i yönetsin" dedi. 
        // Loglar için "kendin oluştur" dedi. O yüzden sadece Administrator yetkisi yeterli.

        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            let settings = await Guild.findOne({ odaId: guild.id });
            if (!settings) {
                settings = new Guild({ odaId: guild.id });
            }

            // 1. Kategori Oluştur
            let category = guild.channels.cache.find(c => c.name === 'LOGS' && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({
                    name: 'LOGS',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        }
                    ]
                });
            }

            // 2. Kanalları Tanımla
            const channelsToCreate = [
                { key: 'message', name: 'message-logs', topic: 'Silinen ve düzenlenen mesaj kayıtları' },
                { key: 'member', name: 'member-logs', topic: 'Sunucuya katılan ve ayrılan üyeler' },
                { key: 'moderation', name: 'mod-logs', topic: 'Ban, Kick, Mute vb. komut kayıtları' },
                { key: 'role', name: 'role-logs', topic: 'Rol oluşturma, silme ve güncelleme kayıtları' },
                { key: 'channel', name: 'channel-logs', topic: 'Kanal oluşturma, silme ve güncelleme kayıtları' },
                { key: 'voice', name: 'voice-logs', topic: 'Ses kanalı giriş/çıkış/değişim kayıtları' },
                { key: 'server', name: 'server-logs', topic: 'Sunucu ayarları ve emoji değişiklikleri' }
            ];

            const createdChannels = [];

            // 3. Kanalları Oluştur/Bul ve DB'ye Kaydet
            for (const ch of channelsToCreate) {
                // Mevcut mu kontrol et (DB'de kayıtlı mı veya ismiyle var mı)
                let channelId = settings.logs[ch.key];
                let channel = guild.channels.cache.get(channelId);

                if (!channel) {
                    // İsimle bulmaya çalış
                    channel = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id);
                }

                if (!channel) {
                    // Yoksa oluştur
                    channel = await guild.channels.create({
                        name: ch.name,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        topic: ch.topic,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            }
                        ]
                    });
                }

                // DB'yi güncelle
                settings.logs[ch.key] = channel.id;
                createdChannels.push(`<#${channel.id}> (${ch.name})`);
            }

            settings.logs.enabled = true;
            await settings.save();

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Log Sistemi Kuruldu')
                .setDescription('Tüm log kanalları başarıyla oluşturuldu ve veritabanına kaydedildi.')
                .addFields({ name: 'Oluşturulan Kanallar', value: createdChannels.join('\n') || 'Kanallar zaten mevcuttu.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Setup-Logs Hatası:', error);
            await interaction.editReply({ content: '❌ Log sistemi kurulurken bir hata oluştu.' });
        }
    }
};
