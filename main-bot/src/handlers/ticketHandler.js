const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const Ticket = require('../../../shared/models/Ticket');
const fs = require('fs');

const TICKET_CATEGORIES = {
    'support': { label: 'Destek Talebi', style: ButtonStyle.Primary, emoji: '🎫' },
    'report': { label: 'Şikayet / Bildiri', style: ButtonStyle.Danger, emoji: '🚨' },
    'application': { label: 'Yetkili Başvurusu', style: ButtonStyle.Success, emoji: '📝' }
};

module.exports = {
    async createTicket(interaction, type) {
        const guild = interaction.guild;
        const member = interaction.member;

        // Kontrol: Zaten açık ticketi var mı?
        const existingTicket = await Ticket.findOne({ guildId: guild.id, userId: member.id, status: 'OPEN' });
        if (existingTicket) {
            return interaction.reply({ content: `Zaten açık bir talebiniz var: <#${existingTicket.channelId}>`, ephemeral: true });
        }

        // Ticket ID belirle
        const ticketCount = await Ticket.countDocuments({ guildId: guild.id });
        const ticketId = ticketCount + 1;
        const ticketNu = String(ticketId).padStart(4, '0');

        // Kategori ID'leri (Ayarlanabilir olmalı, şimdilik varsa Support kategorisi yoksa oluştur)
        // Basitlik için: "TICKETS" kategorisi altına açalım
        let category = guild.channels.cache.find(c => c.name === 'TICKETS' && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: 'TICKETS',
                type: ChannelType.GuildCategory
            });
        }

        const channelName = `${type}-${ticketNu}`;

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                    }
                    // Buraya yetkili rolü de eklenebilir
                ]
            });

            // DB Kayıt
            await Ticket.create({
                guildId: guild.id,
                userId: member.id,
                channelId: channel.id,
                ticketId: ticketId,
                type: type,
                status: 'OPEN'
            });

            // Kanal İçi Mesaj
            const embed = new EmbedBuilder()
                .setTitle(`${TICKET_CATEGORIES[type].label} #${ticketNu}`)
                .setDescription(`Merhaba <@${member.id}>,\n\nDestek talebiniz oluşturuldu. Yetkililer en kısa sürede sizinle ilgilenecektir.\nLütfen sorununuzu detaylı bir şekilde açıklayın.`)
                .setColor('#2f3136')
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Talebi Kapat')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('ticket_transcript')
                        .setLabel('Transcript Al')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📄')
                );

            await channel.send({ content: `<@${member.id}> | @here`, embeds: [embed], components: [row] });

            return interaction.reply({ content: `Biletiniz oluşturuldu: <#${channel.id}>`, ephemeral: true });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Bilet oluşturulurken bir hata oluştu.', ephemeral: true });
        }
    },

    async closeTicket(interaction) {
        const ticket = await Ticket.findOne({ channelId: interaction.channelId });
        if (!ticket) return interaction.reply({ content: 'Bu kanal bir bilet kanalı değil.', ephemeral: true });

        // Onay iste
        if (!interaction.customId.includes('_confirm')) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close_confirm')
                        .setLabel('Kesinlikle Kapat')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('ticket_cancel_close')
                        .setLabel('İptal')
                        .setStyle(ButtonStyle.Secondary)
                );
            return interaction.reply({ content: 'Talebi kapatmak istediğinize emin misiniz?', components: [row], ephemeral: true });
        }

        // Kapatma işlemi
        ticket.status = 'CLOSED';
        ticket.closedAt = new Date();
        await ticket.save();

        await interaction.channel.send('Talep kapatıldı. Kanal 5 saniye içinde silinecek...');

        // Transcript alıp log kanalına atılabilir (User isteği)
        // Şimdilik basit silme
        setTimeout(() => interaction.channel.delete(), 5000);
    },

    // interactionCreate eventinden çağrılacak handler
    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        const { customId } = interaction;

        if (customId.startsWith('ticket_create_')) {
            const type = customId.replace('ticket_create_', '');
            if (TICKET_CATEGORIES[type]) {
                await this.createTicket(interaction, type);
            }
        } else if (customId === 'ticket_close') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close_confirm')
                        .setLabel('Evet, Kapat')
                        .setStyle(ButtonStyle.Danger)
                );
            await interaction.reply({ content: 'Talebi kapatmak istediğinize emin misiniz?', components: [row], ephemeral: true });
        } else if (customId === 'ticket_close_confirm') {
            const ticket = await Ticket.findOne({ channelId: interaction.channelId });
            if (!ticket) return interaction.channel.delete(); // DB'de yoksa direkt sil

            ticket.status = 'CLOSED';
            ticket.closedAt = new Date();
            await ticket.save();

            await interaction.reply('Talep kapatılıyor...');
            setTimeout(() => interaction.channel.delete(), 5000);
        } else if (customId === 'ticket_transcript') {
            await interaction.deferReply({ ephemeral: true });

            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => {
                    return `[${m.createdAt.toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content} ${m.attachments.size > 0 ? '(Dosya)' : ''}`;
                }).join('\n');

                const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${interaction.channel.name}.txt` });

                await interaction.editReply({ files: [attachment] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('Transcript alınırken hata oluştu.');
            }
        }
    }
};
