const {
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const path = require('path');
const { TempVoice } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

/**
 * 🛡️ MASTER VOICE HUB HANDLER
 * Ses kanallarının oluşturulmasını ve yönetimini kontrol eder.
 */

// Voice Hub Ayarları (Setup scripti ile DB'den veya .env'den çekilebilir ama şimdilik burada sabitliyoruz)
const CONFIG = {
    CATEGORY_NAME: '🔊 • VOICE MASTER', // Bu isimdeki kategoriyi arar
    GENERATOR_CHANNEL_NAME: '➕ • Oda Oluştur', // Bu isimdeki kanala girince oda kurar
};

async function handleJoin(newState, user) {
    const member = newState.member;
    const guild = newState.guild;

    // 1. Generator kanalına mı girdi?
    if (newState.channel.name !== CONFIG.GENERATOR_CHANNEL_NAME) return;

    // 2. Kategori kontrolü
    const category = newState.channel.parent;
    if (!category || category.name !== CONFIG.CATEGORY_NAME) return;

    // 3. Kullanıcının zaten odası var mı?
    const existingChannel = await TempVoice.findOne({ ownerId: member.id, odaId: guild.id });
    if (existingChannel) {
        // Var olan odasına taşı
        const channel = guild.channels.cache.get(existingChannel.channelId);
        if (channel) {
            await member.voice.setChannel(channel).catch(() => { });
            return;
        } else {
            // Veritabanında var ama Discord'da yoksa sil
            await TempVoice.deleteOne({ _id: existingChannel._id });
        }
    }

    // 4. Yeni Oda Oluştur
    const newChannelName = `🔊 • ${member.user.username}'s Room`;

    try {
        const voiceChannel = await guild.channels.create({
            name: newChannelName,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                { id: member.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
                { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] }
            ]
        });

        // 5. Kullanıcıyı Taşı
        await member.voice.setChannel(voiceChannel);

        // 6. Veritabanına Kaydet
        await TempVoice.create({
            channelId: voiceChannel.id,
            odaId: guild.id,
            ownerId: member.id,
            name: newChannelName
        });

        // 7. Kontrol Panelini Gönder (Interface)
        await sendControlPanel(voiceChannel, member);

    } catch (error) {
        console.error('Master Voice Hatası:', error);
    }
}

async function handleLeave(oldState) {
    const channel = oldState.channel;

    // Geçici oda mı kontrol et
    const tempChannelDir = await TempVoice.findOne({ channelId: channel.id });
    if (!tempChannelDir) return;

    // Odada kimse kaldı mı?
    if (channel.members.size === 0) {
        // Odayı sil
        await channel.delete().catch(() => { });
        await TempVoice.deleteOne({ channelId: channel.id });
        return;
    }

    // Odadan çıkan sahip mi?
    if (oldState.member.id === tempChannelDir.ownerId) {
        // Sahiplik devri yapılabilir veya oda öylece kalabilir. 
        // Şimdilik sistem odada biri olduğu sürece açık kalsın.
    }
}

// 🎛️ KONTROL PANELİ
async function sendControlPanel(channel, owner) {
    const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle(`🎛️ ${owner.user.username}'s Voice Control`)
        .setDescription('Kanalınızı yönetmek için aşağıdaki butonları kullanın.')
        .addFields(
            { name: '🔒 Kilitle/Aç', value: 'Odayı herkese kapatır/açar.', inline: true },
            { name: '✏️ İsim Değiştir', value: 'Odanın adını değiştirir.', inline: true },
            { name: '👥 Limit Koy', value: 'Kullanıcı limiti belirler.', inline: true }
        )
        .setFooter({ text: 'Nexora Voice Master' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId(`voice_lock_${channel.id}`).setEmoji('🔒').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`voice_unlock_${channel.id}`).setEmoji('🔓').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`voice_edit_${channel.id}`).setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`voice_limit_${channel.id}`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`voice_kick_${channel.id}`).setEmoji('🚫').setStyle(ButtonStyle.Danger)
        );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    // Pin at ki mesaj kaybolmasın (Opsiyonel)
    // await msg.pin().catch(() => {});
}

// 🖱️ BUTON ETKİLEŞİMLERİ
async function handleInteraction(interaction, client) {
    const [action, type, channelId] = interaction.customId.split('_'); // voice_lock_12345

    // Veritabanı kontrolü
    const voiceData = await TempVoice.findOne({ channelId: channelId });
    if (!voiceData) return interaction.reply({ content: '❌ Bu oda artık aktif veritabanında yok.', ephemeral: true });

    // Yetki kontrolü (Sadece oda sahibi)
    if (interaction.user.id !== voiceData.ownerId) {
        return interaction.reply({ content: '❌ Bu odayı sadece sahibi yönetebilir.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return interaction.reply({ content: '❌ Kanal bulunamadı.', ephemeral: true });

    // --- İŞLEMLER ---

    if (type === 'lock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
        await interaction.reply({ content: '🔒 Oda **kilitlendi**. Sadece izinli kişiler girebilir.', ephemeral: true });
    }

    if (type === 'unlock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
        await interaction.reply({ content: '🔓 Oda **açıldı**. Herkes girebilir.', ephemeral: true });
    }

    if (type === 'edit') {
        const modal = new ModalBuilder()
            .setCustomId(`modal_voice_rename_${channelId}`)
            .setTitle('Oda İsmini Değiştir');

        const input = new TextInputBuilder()
            .setCustomId('new_name')
            .setLabel('Yeni İsim')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(32)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    if (type === 'limit') {
        const modal = new ModalBuilder()
            .setCustomId(`modal_voice_limit_${channelId}`)
            .setTitle('Kişi Limiti (0-99)');

        const input = new TextInputBuilder()
            .setCustomId('limit_count')
            .setLabel('Sayı (0 = Sınırsız)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    if (type === 'kick') {
        // Kanaldaki üyeleri listele
        const members = channel.members.filter(m => m.id !== interaction.user.id);
        if (members.size === 0) return interaction.reply({ content: '❌ Odada atılacak kimse yok.', ephemeral: true });

        // Buna basitçe "kimi atmak istersin" diye select menu açabiliriz ama şimdilik basit tutalım.
        // Burada ilk kişiyi atmasın, kullanıcıya soralım.
        // V2'de UserSelectMenu eklenebilir.
        interaction.reply({ content: '⚠️ Bu özellik şu an bakımda (UserSelectMenu eklenecek).', ephemeral: true });
    }
}

// 📝 MODAL HANDLER (Rename & Limit)
async function handleModal(interaction) {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // rename veya limit
    const channelId = parts[3];

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    if (type === 'rename') {
        const newName = interaction.fields.getTextInputValue('new_name');
        await channel.setName(newName);
        await interaction.reply({ content: `✅ Oda ismi **${newName}** olarak değiştirildi.`, ephemeral: true });
    }

    if (type === 'limit') {
        const limitStr = interaction.fields.getTextInputValue('limit_count');
        const limit = parseInt(limitStr);
        if (isNaN(limit)) return interaction.reply({ content: '❌ Geçerli bir sayı girin.', ephemeral: true });

        await channel.setUserLimit(limit);
        await interaction.reply({ content: `✅ Oda limiti **${limit}** kişi olarak ayarlandı.`, ephemeral: true });
    }
}

module.exports = {
    handleJoin,
    handleLeave,
    handleInteraction,
    handleModal
};
