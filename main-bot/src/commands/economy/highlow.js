const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const SUITS = ['♠', '♥', '♦', '♣'];
// Değerler: 2-10 normal, J=11, Q=12, K=13, A=1 (Matematiksel kıyas için basit sayısal değerler)
// High-Low'da A en düşük mü en yüksek mi? Genelde A en düşük (1) veya en yüksek (14) kabul edilir. 
// Standart: 2 en düşük, Ace en yüksek (14).
const RANKS = [
    { name: '2', value: 2 }, { name: '3', value: 3 }, { name: '4', value: 4 },
    { name: '5', value: 5 }, { name: '6', value: 6 }, { name: '7', value: 7 },
    { name: '8', value: 8 }, { name: '9', value: 9 }, { name: '10', value: 10 },
    { name: 'J', value: 11 }, { name: 'Q', value: 12 }, { name: 'K', value: 13 }, { name: 'A', value: 14 }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('High-Low: Sıradaki kart Büyük mü Küçük mü?')
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

        // --- KRİTİK FİX ---
        if (amount <= 0) {
            return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });
        }
        if (amount < 20) {
            return interaction.reply({ content: '❌ Minimum 20 NexCoin bahis yapmalısın.', flags: MessageFlags.Ephemeral });
        }

        // Bakiye Düş
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // OYUN
        let currentMultiplier = 1.0;
        let round = 1;

        // Deste oluştur
        const deck = [];
        SUITS.forEach(s => RANKS.forEach(r => deck.push({ ...r, suit: s })));

        // Karıştır
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        let currentCard = deck.pop(); // İlk kart

        const generateEmbed = (status = 'playing', nextCard = null) => {
            const embed = new EmbedBuilder()
                .setTitle(`🃏 HIGH-LOW (Tur: ${round})`)
                .setDescription(`Bahis: **${amount}** NexCoin | Çarpan: **${currentMultiplier.toFixed(2)}x**\n\n` +
                    `Mevcut Kart: **${currentCard.suit} ${currentCard.name}**\n` +
                    `\nSıradaki kart bundan **Daha Yüksek (⬆️)** mi yoksa **Daha Düşük (⬇️)** mü?`);

            if (status === 'playing') {
                embed.setColor('#3498db');
            } else if (status === 'win') {
                embed.setTitle('🎉 DOĞRU BİLDİN!');
                embed.setDescription(`Mevcut Kart: **${currentCard.suit} ${currentCard.name}**\nYeni Kart: **${nextCard.suit} ${nextCard.name}**\n\nDevam etmek ister misin?`);
                embed.setColor('#2ecc71');
            } else if (status === 'lose') {
                embed.setTitle('💀 YANLIŞ CEVAP!');
                embed.setDescription(`Mevcut Kart: **${currentCard.suit} ${currentCard.name}**\nYeni Kart: **${nextCard.suit} ${nextCard.name}**\n\nKaybettin...`);
                embed.setColor('#e74c3c');
            } else if (status === 'cashout') {
                embed.setTitle('💰 PARA ÇEKİLDİ');
                embed.setDescription(`Son Kart: **${currentCard.suit} ${currentCard.name}**\n\nKazanılan: **${Math.floor(amount * currentMultiplier)}** NexCoin`);
                embed.setColor('#f1c40f');
            }

            return embed;
        };

        const getButtons = (canCashout = false) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hl_lower').setLabel('Düşük ⬇️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hl_higher').setLabel('Yüksek ⬆️').setStyle(ButtonStyle.Primary)
            );

            if (canCashout) {
                row.addComponents(
                    new ButtonBuilder().setCustomId('hl_cashout').setLabel('Nakit Çek 💰').setStyle(ButtonStyle.Success)
                );
            }
            return row;
        };

        await interaction.reply({ embeds: [generateEmbed()], components: [getButtons(round > 1)] });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'hl_cashout') {
                const winAmount = Math.floor(amount * currentMultiplier);
                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmount } });

                await i.update({ embeds: [generateEmbed('cashout')], components: [] });
                collector.stop();
                return;
            }

            const nextCard = deck.pop();
            const guess = i.customId === 'hl_higher' ? 'high' : 'low';

            let won = false;
            // Eşitlik durumunda genelde kasa kazanır veya push olur. Biz devam ettirelim (Push) veya Kaybettirelim.
            // House Edge için: Eşitlik = Kayıp diyelim (Daha zor)
            // Ama kullanıcı dostu olsun: Eşitlik = Devam (Kart değişir, çarpan artmaz)

            if (nextCard.value === currentCard.value) {
                // Eşitlik -> Pas geç, yeni kart ver, çarpan artmasın
                currentCard = nextCard;
                await i.update({ content: '⚠️ Kartlar eşitti! (Push)', embeds: [generateEmbed()], components: [getButtons(round > 1)] });
                return;
            }

            if (guess === 'high' && nextCard.value > currentCard.value) won = true;
            else if (guess === 'low' && nextCard.value < currentCard.value) won = true;

            if (won) {
                // Çarpan Artır (Riske göre hesaplanabilir ama sabit artış şimdilik)
                // Basit mantık: Her doğru x1.4 kazandırır.
                currentMultiplier *= 1.4;
                round++;

                // Show intermediate result
                // Embed'i güncelle ama hemen yeni tura geçme imkanı ver
                const prevCard = currentCard;
                currentCard = nextCard;

                await i.update({ embeds: [generateEmbed('win', currentCard)], components: [getButtons(true)] });
                // Note: user needs to guess again for nextCard vs Unknown
                // But wait, user sees "Mevcut: OldCard", "New: NewCard". 
                // Now game resets playing state for NewCard.
                // UI update loop
                setTimeout(async () => {
                    try {
                        await interaction.editReply({ embeds: [generateEmbed('playing')], components: [getButtons(true)] });
                    } catch (e) { }
                }, 2000);

            } else {
                // Lose
                await i.update({ embeds: [generateEmbed('lose', nextCard)], components: [] });
                collector.stop();
            }
        });
    }
};
