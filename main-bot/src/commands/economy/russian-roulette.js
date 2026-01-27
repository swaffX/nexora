const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rus-ruleti')
        .setDescription('Rus Ruleti: Ya hep ya hiç!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true)),

    async execute(interaction) {
        const betInput = interaction.options.getString('bahis');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // User Check
        let userCheck = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userCheck) return interaction.reply({ content: '❌ Hesabınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount) || amount < 100) {
                return interaction.reply({ content: '❌ Geçersiz miktar. Minimum 100 olmalı.', flags: MessageFlags.Ephemeral });
            }
        }

        // Bakiye Kontrol (Atomik)
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            return interaction.reply({ content: `❌ Yetersiz bakiye!`, flags: MessageFlags.Ephemeral });
        }

        // Animasyon
        const embed = new EmbedBuilder()
            .setColor('#95a5a6')
            .setTitle('🔫 Rus Ruleti')
            .setDescription('Altıpatlar döndürülüyor... 🔄')
            .setThumbnail('https://rec-data.kaleyra.io/img/calendar/giphy.gif'); // Dönme efekti (temsili)

        await interaction.reply({ embeds: [embed] });
        const msg = await interaction.fetchReply();

        // Spin...
        setTimeout(async () => {
            // Tetiği Çek
            // 1/6 ihtimalle patlar (%16.6)
            // Ya da 1 mermi koydum, 6 hazne var.
            const bulletChamber = Math.floor(Math.random() * 6);
            const currentChamber = Math.floor(Math.random() * 6);

            const isDead = bulletChamber === currentChamber;

            if (isDead) {
                // ÖLDÜM
                const deadEmbed = new EmbedBuilder()
                    .setColor('#000000')
                    .setTitle('💀 BAM!')
                    .setDescription(`Tetik çekildi ve... **SİLAH PATLADI!**\n\n💸 **Kaybedilen:** ${amount.toLocaleString()} NexCoin\n👻 **Geçmiş Olsun...**`)
                    .setImage('https://media.tenor.com/2646603463375753995.gif'); // Patlama/Ölüm gifi

                await interaction.editReply({ embeds: [deadEmbed] });

            } else {
                // YAŞADIM (Risk Primi: x2 çok değil çünkü şans yüksek, ama x1.5 olabilir veya tamamen şans)
                // Rus ruleti genelde %83 kazanma şansı olduğu için ödül düşük olur (x1.2 gibi).
                // Ama biz heyecan olsun diye biraz riskli yapalım: 
                // 1/6 Ölüm -> x1.2 kazanç.
                // Eğer mermi sayısını artırırsa ödül artabilir ama şimdilik standart.

                const multiplier = 1.5; // Biraz bonkör olalım
                const winAmount = Math.floor(amount * multiplier);

                const finalUser = await User.findOneAndUpdate(
                    { odasi: userId, odaId: guildId },
                    { $inc: { balance: winAmount } },
                    { new: true }
                );

                const liveEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('😅 KLİK... Boş!')
                    .setDescription(`Şanslı günündesin! Silah patlamadı.\n\n💰 **Kazanılan:** ${winAmount.toLocaleString()} NexCoin (x${multiplier})\n🏦 **Bakiye:** ${finalUser.balance.toLocaleString()}`)
                // .setImage('https://media.giphy.com/media/l0HlO4q8lJ0h5qXDi/giphy.gif'); // Rahatlama

                await interaction.editReply({ embeds: [liveEmbed] });
            }

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
            } catch (e) { }

        }, 2500);
    }
};
