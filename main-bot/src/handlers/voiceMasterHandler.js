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
    , MessageFlags } = require('discord.js');
const path = require('path');
const { TempVoice } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

/**
 * 🛡️ MASTER VOICE HUB HANDLER
 * Ses kanallarının oluşturulmasını ve yönetimini kontrol eder.
 */

// Voice Hub Ayarları (Setup scripti ile DB'den veya .env'den çekilebilir ama şimdilik burada sabitliyoruz)
const CONFIG = {
    CATEGORY_NAME: '🔊 • VOICE MASTER', // Bu isimdeki kategoriyi arar
    GENERATOR_CHANNEL_NAME: '➕ • Kendi Odanı Oluştur', // Bu isimdeki kanala girince oda kurar
};

// Alternatif: Kanal ismini normalize et (emoji ve boşlukları temizle)
function normalizeChannelName(name) {
    if (!name) return '';
    // Emoji ve özel karakterleri temizle, küçük harfe çevir
    return name.toLowerCase().replace(/[^\w\s]/gi, '').trim();
}

async function handleJoin(newState, user) {
    const member = newState.member;
    const guild = newState.guild;

    console.log('[VoiceMaster] handleJoin çağrıldı:', {
        userId: member.id,
        username: member.user.username,
        channelName: newState.channel?.name,
        categoryName: newState.channel?.parent?.name
    });

    // 1. Generator kanalına mı girdi?
    if (!newState.channel) {
        console.log('[VoiceMaster] newState.channel yok, çıkılıyor');
        return;
    }

    // Kanal ismini normalize ederek karşılaştır
    const normalizedChannelName = normalizeChannelName(newState.channel.name);
    const normalizedGeneratorName = normalizeChannelName(CONFIG.GENERATOR_CHANNEL_NAME);
    
    console.log('[VoiceMaster] Normalize edilmiş isimler:', {
        channel: normalizedChannelName,
        generator: normalizedGeneratorName
    });

    if (normalizedChannelName !== normalizedGeneratorName) {
        console.log('[VoiceMaster] Kanal adı eşleşmiyor');
        return;
    }

    // 2. Kategori kontrolü
    const category = newState.channel.parent;
    if (!category) {
        console.log('[VoiceMaster] Kategori yok');
        return;
    }
    
    const normalizedCategoryName = normalizeChannelName(category.name);
    const normalizedConfigCategory = normalizeChannelName(CONFIG.CATEGORY_NAME);
    
    console.log('[VoiceMaster] Normalize edilmiş kategori isimleri:', {
        category: normalizedCategoryName,
        config: normalizedConfigCategory
    });
    
    if (normalizedCategoryName !== normalizedConfigCategory) {
        console.log('[VoiceMaster] Kategori adı eşleşmiyor');
        return;
    }

    console.log('[VoiceMaster] Kontroller geçti, oda oluşturuluyor...');

    // 3. Kullanıcının zaten odası var mı?
    const existingChannel = await TempVoice.findOne({ ownerId: member.id, odaId: guild.id });
    if (existingChannel) {
        console.log('[VoiceMaster] Kullanıcının zaten odası var:', existingChannel.channelId);
        // Var olan odasına taşı
        const channel = guild.channels.cache.get(existingChannel.channelId);
        if (channel) {
            await member.voice.setChannel(channel).catch(() => { });
            return;
        } else {
            // Veritabanında var ama Discord'da yoksa sil
            console.log('[VoiceMaster] Oda DB\'de var ama Discord\'da yok, siliniyor');
            await TempVoice.deleteOne({ _id: existingChannel._id });
        }
    }

    // 4. Yeni Oda Oluştur
    const newChannelName = `🔊 • ${member.user.username}'s Room`;

    try {
        console.log('[VoiceMaster] Yeni kanal oluşturuluyor:', newChannelName);
        const voiceChannel = await guild.channels.create({
            name: newChannelName,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                { id: member.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
                { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] }
            ]
        });

        console.log('[VoiceMaster] Kanal oluşturuldu:', voiceChannel.id);

        // 5. Kullanıcıyı Taşı
        await member.voice.setChannel(voiceChannel);
        console.log('[VoiceMaster] Kullanıcı taşındı');

        // 6. Veritabanına Kaydet
        await TempVoice.create({
            channelId: voiceChannel.id,
            odaId: guild.id,
            ownerId: member.id,
            name: newChannelName
        });
        console.log('[VoiceMaster] DB\'ye kaydedildi');

        // 7. Kontrol Panelini Gönder (Interface)
        await sendControlPanel(voiceChannel, member);
        console.log('[VoiceMaster] Kontrol paneli gönderildi');

    } catch (error) {
        console.error('[VoiceMaster] Hata:', error);
    }
}

async function handleLeave(oldState) {
    const channel = oldState.channel;
    
    // Kanal kontrolü
    if (!channel) return;

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

// 🎛️ KONTROL PANELİ (Canvas Design)
async function sendControlPanel(channel, owner) {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const { AttachmentBuilder } = require('discord.js');

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0c0c0e');
    bgGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
    for (let i = 0; i < height; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke(); }

    // Top accent line
    const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
    accentGrad.addColorStop(0, 'transparent');
    accentGrad.addColorStop(0.3, '#5865F2');
    accentGrad.addColorStop(0.7, '#5865F2');
    accentGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, width, 3);

    // Header glow
    const headerGlow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, 400);
    headerGlow.addColorStop(0, 'rgba(88, 101, 242, 0.08)');
    headerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = headerGlow;
    ctx.fillRect(0, 0, width, 120);

    // Avatar (left side)
    const avatarSize = 80;
    const avatarX = 40;
    const avatarY = 30;
    try {
        const avatarUrl = owner.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 128 });
        const av = await loadImage(avatarUrl);
        // Glow ring
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#5865F2';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#5865F2';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Circular clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(av, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) { }

    // Header text
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#5865F2';
    ctx.textAlign = 'left';
    ctx.fillText('VOICE MASTER', avatarX + avatarSize + 20, avatarY + 25);

    const displayName = owner.user.displayName || owner.user.username;
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${displayName}'s Room`, avatarX + avatarSize + 20, avatarY + 60);

    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText('Hoş geldin! Bu senin özel ses odan.', avatarX + avatarSize + 20, avatarY + 82);

    // Separator line
    const sepY = 130;
    const sepGrad = ctx.createLinearGradient(30, sepY, width - 30, sepY);
    sepGrad.addColorStop(0, 'transparent');
    sepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    sepGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sepGrad;
    ctx.fillRect(30, sepY, width - 60, 1);

    // Section 1: Güvenlik
    const secY1 = 155;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText('Güvenlik', 40, secY1);

    const secItems1 = [
        { label: 'Kilitle', desc: 'Odayı herkese kapat' },
        { label: 'Aç', desc: 'Odayı herkese aç' }
    ];
    let itemY1 = secY1 + 20;
    for (const item of secItems1) {
        // Label pill
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        const lw = ctx.measureText(item.label).width;
        const pillW = lw + 16;
        const pillH = 22;
        ctx.beginPath();
        ctx.roundRect(55, itemY1, pillW, pillH, 6);
        ctx.fillStyle = 'rgba(88, 101, 242, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(88, 101, 242, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText(item.label, 63, itemY1 + 15);
        // Desc
        ctx.font = '13px "Segoe UI", sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText(`- ${item.desc}`, 55 + pillW + 10, itemY1 + 15);
        itemY1 += 30;
    }

    // Section 2: Ayarlar
    const secY2 = secY1 + 90;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText('Ayarlar', 40, secY2);

    const secItems2 = [
        { label: 'İsim', desc: 'Oda ismini değiştir' },
        { label: 'Limit', desc: 'Kişi sınırı belirle' },
        { label: 'At', desc: 'Birini odadan at' }
    ];
    let itemY2 = secY2 + 20;
    for (const item of secItems2) {
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        const lw = ctx.measureText(item.label).width;
        const pillW = lw + 16;
        const pillH = 22;
        ctx.beginPath();
        ctx.roundRect(55, itemY2, pillW, pillH, 6);
        ctx.fillStyle = 'rgba(88, 101, 242, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(88, 101, 242, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#a5b4fc';
        ctx.fillText(item.label, 63, itemY2 + 15);
        ctx.font = '13px "Segoe UI", sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText(`- ${item.desc}`, 55 + pillW + 10, itemY2 + 15);
        itemY2 += 30;
    }

    // Footer
    const footerY = height - 30;
    const footGrad = ctx.createLinearGradient(30, footerY - 5, width - 30, footerY - 5);
    footGrad.addColorStop(0, 'transparent');
    footGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    footGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = footGrad;
    ctx.fillRect(30, footerY - 10, width - 60, 1);

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'center';
    ctx.fillText('🌟 Nexora Voice Master • Odandan çıkınca oda silinir', width / 2, footerY);
    ctx.textAlign = 'left';

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'voicemaster.png' });

    // Row 1: Güvenlik Butonları
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`voice_lock_${channel.id}`)
                .setLabel('Kilitle')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`voice_unlock_${channel.id}`)
                .setLabel('Aç')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Success)
        );

    // Row 2: Ayar Butonları
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`voice_edit_${channel.id}`)
                .setLabel('İsim Değiştir')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`voice_limit_${channel.id}`)
                .setLabel('Limit Koy')
                .setEmoji('👥')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`voice_kick_${channel.id}`)
                .setLabel('Birini At')
                .setEmoji('🚫')
                .setStyle(ButtonStyle.Danger)
        );

    await channel.send({ files: [attachment], components: [row1, row2] });
}

// 🖱️ BUTON ETKİLEŞİMLERİ
async function handleInteraction(interaction, client) {
    const [action, type, channelId] = interaction.customId.split('_'); // voice_lock_12345

    // Veritabanı kontrolü
    const voiceData = await TempVoice.findOne({ channelId: channelId });
    if (!voiceData) return interaction.reply({ content: '❌ Bu oda artık aktif veritabanında yok.', flags: MessageFlags.Ephemeral });

    // Yetki kontrolü (Sadece oda sahibi)
    if (interaction.user.id !== voiceData.ownerId) {
        return interaction.reply({ content: '❌ Bu odayı sadece sahibi yönetebilir.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return interaction.reply({ content: '❌ Kanal bulunamadı.', flags: MessageFlags.Ephemeral });

    // --- İŞLEMLER ---

    if (type === 'lock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
        await interaction.reply({ content: '🔒 Oda **kilitlendi**. Sadece izinli kişiler girebilir.', flags: MessageFlags.Ephemeral });
    }

    if (type === 'unlock') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
        await interaction.reply({ content: '🔓 Oda **açıldı**. Herkes girebilir.', flags: MessageFlags.Ephemeral });
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
        const { UserSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

        // 1. Yetkili Rol Kontrolü (Owner OR Admin OR Mod)
        const path = require('path');
        const CONFIG = require(path.join(__dirname, '..', '..', '..', 'custom-bot', 'src', 'config'));
        // Yollar farklı olduğu için basitçe hard-code veya require path'i ayarlamak gerek.
        // Şimdilik interaction.member.permissions ile yetkilendirelim (ManageChannels)
        // Veya konfigüre edilebilir rol ID'leri.

        if (interaction.user.id !== voiceData.ownerId && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ Sadece oda sahibi veya yetkililer atabilir.', flags: MessageFlags.Ephemeral });
        }

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`voice_kick_confirm_${channelId}`)
            .setPlaceholder('Atılacak kullanıcıyı seçin')
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: '🚫 **Kimi atmak istersin?**\n(Oda sahibi veya yetkililer atılamaz)',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }

}

// 🦶 KICK HANDLER (Yeni Eklenen)
async function handleKickConfirm(interaction) {
    // Custom ID: voice_kick_confirm_CHANNELID
    const channelId = interaction.customId.split('_')[3];
    const targetUserId = interaction.values[0];

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return interaction.reply({ content: '❌ Kanal bulunamadı.', flags: MessageFlags.Ephemeral });

    // Hedef kişi kanalda mı?
    const member = channel.members.get(targetUserId);
    if (!member) return interaction.reply({ content: '❌ Kullanıcı şu an odada değil.', flags: MessageFlags.Ephemeral });

    // Kendini atamaz
    if (member.id === interaction.user.id) return interaction.reply({ content: '❌ Kendini atamazsın.', flags: MessageFlags.Ephemeral });

    // Yetkiliyi atamaz (Basit kontrol)
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Yöneticileri atamazsın.', flags: MessageFlags.Ephemeral });

    try {
        await member.voice.disconnect(`Voice Master: Kicked by ${interaction.user.tag}`);
        // Opsiyonel: Banlamak istersen permissionOverwrites kullanabilirsin.
        await channel.permissionOverwrites.edit(member, { Connect: false });

        interaction.reply({ content: `✅ **${member.user.tag}** odadan atıldı ve girişi engellendi.`, flags: MessageFlags.Ephemeral });
    } catch (error) {
        interaction.reply({ content: `❌ Hata: ${error.message}`, flags: MessageFlags.Ephemeral });
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
        await interaction.reply({ content: `✅ Oda ismi **${newName}** olarak değiştirildi.`, flags: MessageFlags.Ephemeral });
    }

    if (type === 'limit') {
        const limitStr = interaction.fields.getTextInputValue('limit_count');
        const limit = parseInt(limitStr);
        if (isNaN(limit)) return interaction.reply({ content: '❌ Geçerli bir sayı girin.', flags: MessageFlags.Ephemeral });

        await channel.setUserLimit(limit);
        await interaction.reply({ content: `✅ Oda limiti **${limit}** kişi olarak ayarlandı.`, flags: MessageFlags.Ephemeral });
    }
}

module.exports = {
    handleJoin,
    handleLeave,
    handleInteraction,
    handleModal,
    handleKickConfirm // Exported
};
