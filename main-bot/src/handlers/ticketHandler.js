const path = require('path');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Guild, Ticket } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    async handleButton(interaction, args, client) {
        const action = args[0];

        if (action === 'create') {
            // Mevcut açık ticket kontrolü
            const existingTicket = await Ticket.findOne({
                odaId: interaction.guild.id,
                odasi: interaction.user.id,
                status: 'open'
            });

            if (existingTicket) {
                return interaction.reply({
                    embeds: [embeds.warning('Uyarı', `Zaten açık bir ticketınız var: <#${existingTicket.channelId}>`)],
                    ephemeral: true
                });
            }

            // Sayacı Atomik Artır
            const updatedGuild = await Guild.findOneAndUpdate(
                { odaId: interaction.guild.id },
                { $inc: { 'ticket.count': 1 } },
                { new: true, upsert: true }
            );

            // Ticket kanalı oluştur
            try {
                // Kategori Cache Kontrolü
                let category = interaction.guild.channels.cache.get(updatedGuild.ticket.categoryId);
                // Cache'de yoksa fetchle (Kullanıcı kategori ID'sini yeni verdi)
                if (!category && updatedGuild.ticket.categoryId) {
                    try { category = await interaction.guild.channels.fetch(updatedGuild.ticket.categoryId); } catch (e) { }
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${updatedGuild.ticket.count}`, // Kullanıcı isteği: Sıralı sayı
                    type: ChannelType.GuildText,
                    parent: category,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: ['ViewChannel']
                        },
                        {
                            id: interaction.user.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                        },
                        ...(updatedGuild.ticket.supportRoles || []).map(roleId => ({
                            id: roleId,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                        }))
                    ]
                });

                // Ticket veritabanına kaydet
                await Ticket.create({
                    odaId: interaction.guild.id,
                    odasi: interaction.user.id,
                    channelId: ticketChannel.id
                });

                // Ticket mesajı
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`🎫 Destek Talebi #${updatedGuild.ticket.count}`)
                    .setDescription(updatedGuild.ticket.welcomeMessage || 'Merhaba! Destek talebiniz oluşturuldu. Lütfen sorununuzu açıklayın.')
                    .setFooter({ text: `Ticket sahibi: ${interaction.user.tag}` })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_close')
                            .setLabel('Kapat')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                await ticketChannel.send({
                    content: `<@${interaction.user.id}>`,
                    embeds: [embed],
                    components: [row]
                });

                await interaction.reply({
                    embeds: [embeds.success('Ticket Oluşturuldu', `Ticket açıldı: ${ticketChannel}`)],
                    ephemeral: true
                });

            } catch (error) {
                console.error('Ticket hatası:', error);
                await interaction.reply({
                    embeds: [embeds.error('Hata', 'Ticket oluşturulamadı. (Kategori veya Yetki Hatası)')],
                    ephemeral: true
                });
            }
        }

        if (action === 'close') {
            const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

            if (!ticket) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Bu kanal bir ticket değil.')],
                    ephemeral: true
                });
            }

            ticket.status = 'closed';
            ticket.closedAt = new Date();
            ticket.closedBy = interaction.user.id;
            await ticket.save();

            await interaction.reply({
                embeds: [embeds.warning('Ticket Kapatılıyor', '5 saniye içinde silinecek...')]
            });

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) { }
            }, 5000);
        }
    },

    async handleSelect(interaction, args, client) {
        // Select menu işlemleri
    }
};
