const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cups')
        .setDescription('Bul Karayı Al Parayı: Top hangi bardağın altında?')
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
        if (!userCheck) return interaction.reply({ content: '❌ Kaydınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount)) return interaction.reply({ content: '❌ Geçersiz miktar.', flags: MessageFlags.Ephemeral });
        }

        // --- KRİTİK FİX: 0 Bakiye Kontrolü ---
        if (amount <= 0) {
            return interaction.reply({ content: '❌ Yetersiz bakiye! Bahis miktarı 0 olamaz.', flags: MessageFlags.Ephemeral });
        }
        if (amount < 50) {
            return interaction.reply({ content: '❌ Minimum 50 NexCoin bahis yapmalısın.', flags: MessageFlags.Ephemeral });
        }

        // Bakiye Düş
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // OYUN
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🥤 BUL KARAYI AL PARAYI')
            .setDescription(`Bahis: **${amount}** NexCoin\n\nTop hangi bardağın altında? Şansını dene! (Kazanma: x2.5)`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cup_1').setLabel('Bardak 1').setStyle(ButtonStyle.Secondry).setEmoji('🥤'),
            new ButtonBuilder().setCustomId('cup_2').setLabel('Bardak 2').setStyle(ButtonStyle.Secondry).setEmoji('🥤'),
            new ButtonBuilder().setCustomId('cup_3').setLabel('Bardak 3').setStyle(ButtonStyle.Secondry).setEmoji('🥤')
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000
        });

        collector.on('collect', async i => {
            // Şans: %33
            // Bilgisayar rastgele bir bardak seçer (1-3)
            const winningCup = Math.floor(Math.random() * 3) + 1; // 1, 2, 3
            const selectedCup = parseInt(i.customId.split('_')[1]); // 1, 2, 3

            let resultRow = new ActionRowBuilder();

            // Butonları güncelle (Kazananı göster)
            for (let k = 1; k <= 3; k++) {
                const btn = new ButtonBuilder()
                    .setCustomId(`cup_end_${k}`)
                    .setLabel(`Bardak ${k}`)
                    .setDisabled(true);

                if (k === winningCup) {
                    btn.setStyle(ButtonStyle.Success).setEmoji('⚽'); // Top buradaydı
                } else if (k === selectedCup) {
                    btn.setStyle(ButtonStyle.Danger).setEmoji('❌'); // Yanlış seçim
                } else {
                    btn.setStyle(ButtonStyle.Secondary).setEmoji('💨'); // Boş
                }
                resultRow.addComponents(btn);
            }

            if (selectedCup === winningCup) {
                // KAZANDI (x2.5)
                const winAmount = Math.floor(amount * 2.5);
                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmount } });

                embed.setTitle('🎉 TEBRİKLER! BULDU!');
                embed.setColor('#2ecc71');
                embed.setDescription(`Topu buldun!\n💰 **Kazanılan:** ${winAmount} NexCoin`);
            } else {
                // KAYBETTİ
                embed.setTitle('❌ MALESEF...');
                embed.setColor('#e74c3c');
                embed.setDescription(`Top **${winningCup}.** bardağın altındaydı.\nParan gitti...`);
            }

            await i.update({ embeds: [embed], components: [resultRow] });
            collector.stop();

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
            } catch (e) { }
        });

        collector.on('end', (c, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏳ Süre doldu.', components: [] }).catch(() => { });
            }
        });
    }
};
