const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Slot makinesini çevir')
        .addStringOption(opt =>
            opt.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true))
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
        // ROL KONTROLÜ (1463875340513317089)
        const { PermissionsBitField } = require('discord.js');
        const ALLOWED_ROLE_ID = '1463875340513317089';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için gerekli **Casino Erişim Rolüne** sahip değilsiniz.', flags: MessageFlags.Ephemeral });
        }

        const betInput = interaction.options.getString('bahis');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Kullanıcıyı bul
        let user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user) {
            return interaction.reply({
                content: `❌ Henüz hesabın oluşmamış. Bir mesaj atarak oluşturabilirsin.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Miktar Hesapla
        let bet = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            bet = user.balance;
        } else {
            bet = parseInt(betInput);
            if (isNaN(bet)) {
                return interaction.reply({ content: '❌ Geçerli bir sayı veya \'all\' girmelisin.', flags: MessageFlags.Ephemeral });
            }
        }

        if (bet < 10) {
            return interaction.reply({ content: '❌ Minimum bahis miktarı **10** NexCoin.', flags: MessageFlags.Ephemeral });
        }

        if (bet > 50000 && betInput.toLowerCase() !== 'all') { // 'all' limiti aşabilir
            // İsteğe bağlı max limit kontrolü buraya
        }

        // Bakiye Kontrol ve Düşüm (Atomik)
        const userData = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: bet } },
            { $inc: { balance: -bet } },
            { new: true }
        );

        if (!userData) {
            return interaction.reply({
                embeds: [embeds.error('Yetersiz Bakiye', `Bu bahis için **${(bet - (user?.balance || 0)).toLocaleString()} NexCoin** eksiğiniz var.`)]
            });
        }

        // Slot emojileri
        const slots = ['🍒', '🍋', '🍇', '🍉', '🍓', '💎', '7️⃣'];

        // Animasyon efekti için dönen slotlar
        const spinMsg = await interaction.reply({
            content: `🎰 **SLOTS** 🎰\n\n[ 🍒 | 🍇 | 7️⃣ ]\n\nÇeviriliyor...`
        });

        // Küçük bir gecikme (animasyon hissi)
        await new Promise(r => setTimeout(r, 1500));

        // Sonuçları belirle
        const result1 = slots[Math.floor(Math.random() * slots.length)];
        const result2 = slots[Math.floor(Math.random() * slots.length)];
        const result3 = slots[Math.floor(Math.random() * slots.length)];

        // Kazanma Kontrolü
        let winnings = 0;
        let message = '';
        let color = 0xE74C3C; // Kayıp (Kırmızı)

        // 3'ü aynı
        if (result1 === result2 && result2 === result3) {
            if (result1 === '7️⃣') {
                winnings = bet * 10;
                message = `**JACKPOT!** Muhteşem! **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0xF1C40F;
            } else if (result1 === '💎') {
                winnings = bet * 5;
                message = `**BÜYÜK KAZANÇ!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0x3498DB;
            } else {
                winnings = bet * 3;
                message = `**TEBRİKLER!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
                color = 0x2ECC71;
            }
        }
        // 2'si aynı (2x)
        else if (result1 === result2 || result2 === result3 || result1 === result3) {
            winnings = bet * 2;
            message = `**Güzel!** **${winnings.toLocaleString()} NexCoin** kazandınız!`;
            color = 0x2ECC71;
        }
        // Kayıp
        else {
            message = `Kaybettiniz... **${bet.toLocaleString()} NexCoin** gitti.`;
        }

        let finalBalance = userData.balance;

        if (winnings > 0) {
            // Ödülü Ver (Atomik)
            const updatedUser = await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $inc: { balance: winnings } },
                { new: true }
            );
            finalBalance = updatedUser.balance;
        }

        // Sonucu düzenle
        await interaction.editReply({
            content: null,
            embeds: [{
                title: '🎰 Slot Machine',
                description: `**[ ${result1} | ${result2} | ${result3} ]**\n\n${message}`,
                color: color,
                footer: { text: `Bakiye: ${finalBalance.toLocaleString()} NexCoin` }
            }]
        });

        // Quest Update
        try {
            const { updateQuestProgress } = require('../../utils/questManager');
            await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
        } catch (e) { console.error(e); }
    }
};
