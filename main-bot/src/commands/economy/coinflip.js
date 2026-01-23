const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const COIN_GIF = 'https://media.tenor.com/ImDnCd-qDDAAAAAi/coin-flip-flip.gif'; // Generic coin flip gif
const HEADS_IMG = 'https://i.imgur.com/M6v1nUf.png'; // Placeholder or Emoji
const TAILS_IMG = 'https://i.imgur.com/M6v1nUf.png'; // Placeholder or Emoji

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bahisli Yazı Tura! (OwO Stili)')
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
        let user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user) user = new User({ odasi: userId, odaId: guildId });

        if (user.balance < amount) {
            return interaction.reply({
                content: `🚫 **Yetersiz Bakiye!**\nMevcut paran: **${user.balance.toLocaleString()}** NexCoin\nGereken: **${amount.toLocaleString()}** NexCoin`,
                ephemeral: true
            });
        }

        // 2. Bahsi Al
        user.balance -= amount;
        await user.save();

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
                user.balance += winAmount;
                await user.save();

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
                .setThumbnail(isHeads ? 'https://em-content.zobj.net/source/microsoft-teams/363/soft-ice-cream_1f366.png' : 'https://em-content.zobj.net/source/microsoft-teams/363/soft-ice-cream_1f366.png') // Placeholder images can be improved
                .setFooter({ text: 'Nexora Casino 🎰', iconURL: interaction.client.user.displayAvatarURL() });

            // Thumbnail logic cleanup:
            // Sadece emojiyi metin içinde kullanmak daha temiz OwO stili için.
            if (result === 'yazi') resultEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/217/217853.png'); // Gold coin
            else resultEmbed.setThumbnail('https://cdn-icons-png.flaticon.com/512/217/217859.png'); // Silver/Tails coin like

            await interaction.editReply({ embeds: [resultEmbed] });

        }, 2000);
    }
};
