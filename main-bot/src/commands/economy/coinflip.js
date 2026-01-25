const { SlashCommandBuilder, EmbedBuilder , MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const COIN_GIF = 'https://media.tenor.com/ImDnCd-qDDAAAAAi/coin-flip-flip.gif'; // Generic coin flip gif
const HEADS_IMG = 'https://i.imgur.com/M6v1nUf.png'; // Placeholder or Emoji
const TAILS_IMG = 'https://i.imgur.com/M6v1nUf.png'; // Placeholder or Emoji

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bahisli Yazı Tura Oyunu')
        .addIntegerOption(option =>
            option.setName('miktar')
                .setDescription('Bahis miktarı')
                .setRequired(true)
                .setMinValue(50))
        .addStringOption(option =>
            option.setName('secim')
                .setDescription('Yazı mı Tura mı?')
                .setRequired(true)
                .addChoices({ name: '🟡 Yazı', value: 'yazi' }, { name: '⚪ Tura', value: 'tura' })),

    async execute(interaction) {
        const amount = interaction.options.getInteger('miktar');
        const choice = interaction.options.getString('secim');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 1. Bakiye Kontrolü
        // 1. & 2. ATOMİK İŞLEM (Bakiye Kontrol + Düşüm)
        let user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            // User yoksa oluştur (Balance 0) veya yetersiz bakiye
            // Eğer user hiç yoksa findOneAndUpdate null döner, bu durumda create edip tekrar kontrol etmek yerine
            // direkt hata dönmek daha güvenli. Oyun oynamak için önce para kazanmalı.
            const checkUser = await User.findOne({ odasi: userId, odaId: guildId });
            return interaction.reply({
                content: `🚫 **Yetersiz Bakiye!**\nMevcut paran: **${checkUser ? checkUser.balance.toLocaleString() : 0}** NexCoin\nGereken: **${amount.toLocaleString()}** NexCoin`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 3. Animasyonlu Başlangıç Embedi
        const startEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🪙 Yazı Tura Atılıyor...')
            .setDescription(`**${interaction.user.username}** havaya **${amount.toLocaleString()}** NexCoin fırlattı! \nSeçim: **${choice === 'yazi' ? '🟡 Yazı' : '⚪ Tura'}**`)
            .setThumbnail(COIN_GIF);

        await interaction.reply({ embeds: [startEmbed] });

        // 4. Sonuç Hesapla (1.5 saniye bekle)
        setTimeout(async () => {
            const isHeads = Math.random() < 0.5;
            const result = isHeads ? 'yazi' : 'tura';
            const isWin = result === choice;

            // Kazanma/Kaybetme Logic
            let endTitle = '';
            let endDesc = '';
            let endColor = '';

            if (isWin) {
                const winAmount = amount * 2;
                // ATOMİK İŞLEM: Ödül
                await User.findOneAndUpdate(
                    { odasi: userId, odaId: guildId },
                    { $inc: { balance: winAmount } }
                );
                user.balance += winAmount; // Gösterim için

                endTitle = '🎉 KAZANDIN!';
                endDesc = `Para yere düştü ve **${result === 'yazi' ? '🟡 YAZI' : '⚪ TURA'}** geldi!\n\n💰 **Kazanılan:** ${winAmount.toLocaleString()} NexCoin\n🏦 **Yeni Bakiye:** ${user.balance.toLocaleString()} NexCoin`;
                endColor = '#2ecc71'; // Green
            } else {
                // Zaten düşmüştük, sadece kaydetmeye gerek yok veritabanı zaten güncel (-amount)
                endTitle = '💀 KAYBETTİN...';
                endDesc = `Para yere düştü ve **${result === 'yazi' ? '🟡 YAZI' : '⚪ TURA'}** geldi...\n\n💸 **Kaybedilen:** ${amount.toLocaleString()} NexCoin\n🏦 **Yeni Bakiye:** ${user.balance.toLocaleString()} NexCoin`;
                endColor = '#e74c3c'; // Red
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(endColor)
                .setTitle(endTitle)
                .setDescription(endDesc)
                .setThumbnail(isHeads ? 'https://em-content.zobj.net/source/microsoft-teams/363/soft-ice-cream_1f366.png' : 'https://em-content.zobj.net/source/microsoft-teams/363/soft-ice-cream_1f366.png')
                .setFooter({ text: 'Nexora Casino 🎰', iconURL: interaction.client.user.displayAvatarURL() });

            if (result === 'yazi') resultEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/217/217853.png');
            else resultEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/217/217859.png');

            await interaction.editReply({ embeds: [resultEmbed] });

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
            } catch (e) { console.error(e); }

        }, 2000);
    }
};
