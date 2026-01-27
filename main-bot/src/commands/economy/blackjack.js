const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Krupiyeye karşı Blackjack (21) oyna!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true)),

    async execute(interaction) {
        const betInput = interaction.options.getString('bahis');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 1. Kullanıcı Kontrol & Bakiye Çek
        let userAuth = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userAuth) return interaction.reply({ content: '❌ Hesabınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userAuth.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount) || amount < 50) {
                return interaction.reply({ content: '❌ Minimum 50 NexCoin bahis yapmalısın.', flags: MessageFlags.Ephemeral });
            }
        }

        // 2. Bakiye Düşümü (Atomik)
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            return interaction.reply({ content: `❌ Yetersiz Bakiye! Mevcut: ${userAuth.balance}`, flags: MessageFlags.Ephemeral });
        }

        // --- OYUN MANTIĞI ---

        // Deste Oluştur ve Karıştır
        let deck = createDeck();
        shuffle(deck);

        // İlk Kartlar
        let playerHand = [drawCard(deck), drawCard(deck)];
        let dealerHand = [drawCard(deck), drawCard(deck)];

        // Oyun Durumu
        let gameOver = false;
        let playerTurn = true;
        let messageLog = '';

        // İlk Kontrol (Doğal Blackjack)
        const playerValue = calculateHand(playerHand);
        if (playerValue === 21) {
            gameOver = true;
            playerTurn = false;
        }

        // Görsel Fonksiyonları
        const generateEmbed = (hideDealer = true, resultText = null, resultColor = null) => {
            const pVal = calculateHand(playerHand);
            const dVal = hideDealer ? calculateHand([dealerHand[0]]) : calculateHand(dealerHand);

            const embed = new EmbedBuilder()
                .setColor(resultColor || '#2f3136')
                .setTitle(resultText || '🃏 Blackjack Masası')
                .addFields(
                    {
                        name: `👤 ${interaction.user.username} (${pVal})`,
                        value: formatHand(playerHand),
                        inline: true
                    },
                    {
                        name: `🕴️ Krupiye (${hideDealer && !gameOver ? '?' : dVal})`,
                        value: hideDealer && !gameOver
                            ? `${formatCard(dealerHand[0])} | 🎴`
                            : formatHand(dealerHand),
                        inline: true
                    }
                )
                .setFooter({ text: `Bahis: ${amount} NexCoin | Bakiye: ${user.balance}` });

            if (messageLog) embed.setDescription(messageLog);
            return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Kart Çek').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Dur').setStyle(ButtonStyle.Secondary).setEmoji('🛑'),
            new ButtonBuilder().setCustomId('bj_double').setLabel('İkiye Katla').setStyle(ButtonStyle.Success).setEmoji('💰').setDisabled(user.balance < amount)
        );

        // Oyunu Başlat
        const replyResponse = await interaction.reply({
            embeds: [generateEmbed(true)],
            components: gameOver ? [] : [buttons]
        });

        const reply = await interaction.fetchReply();

        if (gameOver) {
            return endGame(interaction, reply, playerHand, dealerHand, amount, deck, userId, guildId, 'natural');
        }

        // Collector (Buton Dinleyici)
        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate(); // Hızlı yanıt

            if (i.customId === 'bj_hit') {
                playerHand.push(drawCard(deck));
                const val = calculateHand(playerHand);

                if (val > 21) {
                    collector.stop('bust');
                } else if (val === 21) {
                    collector.stop('stand'); // Otomatik dur
                } else {
                    // Devam
                    await i.editReply({ embeds: [generateEmbed(true)] });
                }

            } else if (i.customId === 'bj_stand') {
                collector.stop('stand');

            } else if (i.customId === 'bj_double') {
                // Para Kontrolü
                const doubleCheck = await User.findOneAndUpdate(
                    { odasi: userId, odaId: guildId, balance: { $gte: amount } },
                    { $inc: { balance: -amount } },
                    { new: true }
                );

                if (doubleCheck) {
                    amount *= 2; // Bahsi katla
                    user.balance = doubleCheck.balance; // Bakiyeyi güncelle
                    playerHand.push(drawCard(deck)); // Tek kart çek

                    const val = calculateHand(playerHand);
                    if (val > 21) collector.stop('bust');
                    else collector.stop('stand');
                } else {
                    await i.followUp({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'bust') {
                await endGame(interaction, reply, playerHand, dealerHand, amount, deck, userId, guildId, 'bust');
            } else if (reason === 'stand') {
                // Krupiye Oynasın
                let dVal = calculateHand(dealerHand);
                while (dVal < 17) {
                    dealerHand.push(drawCard(deck));
                    dVal = calculateHand(dealerHand);
                }
                await endGame(interaction, reply, playerHand, dealerHand, amount, deck, userId, guildId, 'finish');
            } else if (reason === 'time') {
                await interaction.editReply({ content: '⏳ Süre doldu, oyun iptal.', components: [] });
            }
        });
    }
};

// --- YARDIMCI FONKSİYONLAR ---

function createDeck() {
    let deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function drawCard(deck) {
    return deck.pop();
}

function calculateHand(hand) {
    let value = 0;
    let aces = 0;

    for (let card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else if (card.value === 'A') {
            aces += 1;
            value += 11;
        } else {
            value += parseInt(card.value);
        }
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }
    return value;
}

function formatCard(card) {
    // Emojili kart gösterimi yapılabilir, şimdilik text
    return `[${card.suit} ${card.value}]`;
}

function formatHand(hand) {
    return hand.map(c => `\`${c.suit} ${c.value}\``).join(' ');
}

async function endGame(interaction, message, playerHand, dealerHand, amount, deck, userId, guildId, reason) {
    const pVal = calculateHand(playerHand);
    const dVal = calculateHand(dealerHand);

    let result = '';
    let color = '';
    let winAmount = 0;

    if (reason === 'natural') {
        // Natural Blackjack (İlk elden 21) -> 3:2 öder (2.5x)
        if (dVal === 21) {
            result = '👔 BERABERE (Push)';
            winAmount = amount; // İade
            color = '#f1c40f';
        } else {
            result = '🔥 BLACKJACK!';
            winAmount = Math.floor(amount * 2.5);
            color = '#ffd700'; // Gold
        }
    } else if (reason === 'bust') {
        result = '💥 PATLADIN! (Bust)';
        winAmount = 0;
        color = '#e74c3c';
    } else {
        // Normal Bitiş
        if (dVal > 21) {
            result = '🎉 KRUPİYE PATLADI! Kazandın.';
            winAmount = amount * 2;
            color = '#2ecc71';
        } else if (pVal > dVal) {
            result = '🎉 KAZANDIN!';
            winAmount = amount * 2;
            color = '#2ecc71';
        } else if (pVal === dVal) {
            result = '👔 BERABERE (Push)';
            winAmount = amount; // İade
            color = '#95a5a6';
        } else {
            result = '💀 KRUPİYE KAZANDI.';
            winAmount = 0;
            color = '#e74c3c';
        }
    }

    // Ödül Varsa Ver
    let finalBalance = 0;
    if (winAmount > 0) {
        const u = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId },
            { $inc: { balance: winAmount } },
            { new: true }
        );
        finalBalance = u.balance;
    } else {
        const u = await User.findOne({ odasi: userId, odaId: guildId });
        finalBalance = u.balance;
    }

    // Embed Güncelle
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(result)
        .addFields(
            { name: `👤 Oyuncu (${pVal})`, value: formatHand(playerHand), inline: true },
            { name: `🕴️ Krupiye (${dVal})`, value: formatHand(dealerHand), inline: true }
        )
        .setFooter({ text: `Kazanılan: ${winAmount} | Yeni Bakiye: ${finalBalance}` });

    // Butonları kaldır
    await message.edit({ embeds: [embed], components: [] });

    // Quest Update
    try {
        const { updateQuestProgress } = require('../../utils/questManager');
        await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
    } catch (e) { }
}
