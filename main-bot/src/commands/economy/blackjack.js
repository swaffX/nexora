const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Bahisli Blackjack (21) oynayın.')
        .addIntegerOption(opt =>
            opt.setName('bahis')
                .setDescription('Bahis miktarı')
                .setRequired(true)
                .setMinValue(50)),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bahis');
        const user = await User.findOrCreate(interaction.user.id, interaction.guild.id, interaction.user.username);

        if (user.balance < bet) {
            return interaction.reply({ content: '❌ Yetersiz bakiye!', ephemeral: true });
        }

        await interaction.deferReply();

        // Parayı çek
        user.balance -= bet;
        await user.save();

        // Deste ve Eller
        let deck = createDeck();
        let playerHand = [drawCard(deck), drawCard(deck)];
        let dealerHand = [drawCard(deck), drawCard(deck)];

        // Oyun Durumu
        let gameState = {
            deck,
            playerHand,
            dealerHand,
            bet,
            gameOver: false,
            result: null
        };

        // Blackjack Kontrolü
        if (calculateScore(playerHand) === 21) {
            gameState.gameOver = true;
            gameState.result = 'BLACKJACK';
            user.balance += Math.floor(bet * 2.5);
            user.stats.totalWins += 1;
            await user.save();
        }

        const msg = await interaction.editReply(generateMessage(interaction.user, gameState));

        if (gameState.gameOver) return;

        // Butonlar
        const filter = i => i.user.id === interaction.user.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (gameState.gameOver) return;

            if (i.customId === 'bj_hit') {
                gameState.playerHand.push(drawCard(gameState.deck));
                const score = calculateScore(gameState.playerHand);

                if (score > 21) {
                    gameState.gameOver = true;
                    gameState.result = 'BUST'; // Kaybetti
                    collector.stop();
                } else if (score === 21) {
                    // Otomatik Stand
                    await dealerTurn(gameState, user);
                    collector.stop();
                }
            } else if (i.customId === 'bj_stand') {
                await dealerTurn(gameState, user);
                collector.stop();
            } else if (i.customId === 'bj_double') {
                if (user.balance < bet) {
                    return i.reply({ content: '❌ İkiye katlamak için paranız yetersiz!', ephemeral: true });
                }
                user.balance -= bet;
                gameState.bet *= 2;
                gameState.playerHand.push(drawCard(gameState.deck));

                // Tek kart verilir ve sıra krupiyeye geçer (veya patlar)
                const score = calculateScore(gameState.playerHand);
                if (score > 21) {
                    gameState.gameOver = true;
                    gameState.result = 'BUST';
                } else {
                    await dealerTurn(gameState, user);
                }
                collector.stop();
            }

            await user.save();
            await i.update(generateMessage(interaction.user, gameState));
        });

        collector.on('end', async () => {
            if (!gameState.gameOver) {
                // Zaman aşımı = Otomatik Stand
                await dealerTurn(gameState, user);
                await user.save();
                await interaction.editReply(generateMessage(interaction.user, gameState));
            }
        });
    }
};

function createDeck() {
    let deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    // Basit bir karıştırma
    return deck.sort(() => Math.random() - 0.5);
}

function drawCard(deck) {
    return deck.pop();
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) score += 10;
        else if (card.value === 'A') {
            aces += 1;
            score += 11;
        } else {
            score += parseInt(card.value);
        }
    }

    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }
    return score;
}

async function dealerTurn(gameState, user) {
    let dealerScore = calculateScore(gameState.dealerHand);

    // Krupiye 17 olana kadar çeker
    while (dealerScore < 17) {
        gameState.dealerHand.push(drawCard(gameState.deck));
        dealerScore = calculateScore(gameState.dealerHand);
    }

    const playerScore = calculateScore(gameState.playerHand);

    gameState.gameOver = true;

    if (dealerScore > 21) {
        gameState.result = 'WIN';
        user.balance += gameState.bet * 2;
        user.stats.totalWins += 1;
    } else if (dealerScore > playerScore) {
        gameState.result = 'LOSE';
    } else if (dealerScore < playerScore) {
        gameState.result = 'WIN';
        user.balance += gameState.bet * 2;
        user.stats.totalWins += 1;
    } else {
        gameState.result = 'PUSH'; // Berabere
        user.balance += gameState.bet; // İade
    }
}

function generateMessage(user, gameState) {
    const playerScore = calculateScore(gameState.playerHand);
    const dealerScore = calculateScore(gameState.dealerHand);

    let resultMsg = '';
    let color = 0x5865F2; // Blurple

    if (gameState.gameOver) {
        const dealerCards = gameState.dealerHand.map(c => `\`${c.value}${c.suit}\``).join(' ');

        if (gameState.result === 'BLACKJACK') { resultMsg = '🔥 BLACKJACK! (2.5x)'; color = 0xFFD700; }
        else if (gameState.result === 'WIN') { resultMsg = '🎉 KAZANDIN! (2x)'; color = 0x2ECC71; }
        else if (gameState.result === 'LOSE') { resultMsg = '💀 KAYBETTİN'; color = 0xED4245; }
        else if (gameState.result === 'BUST') { resultMsg = '💥 PATLADIN (BUST)'; color = 0xED4245; }
        else { resultMsg = '🤝 BERABERE (İade)'; color = 0xFEE75C; }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: `${user.username} vs Krupiye`, iconURL: user.displayAvatarURL() })
            .setDescription(`**SONUÇ:** ${resultMsg}\n💵 **Kazanç:** ${gameState.result === 'LOSE' || gameState.result === 'BUST' ? `-${gameState.bet}` : `+${gameState.result === 'PUSH' ? 0 : (gameState.result === 'BLACKJACK' ? Math.floor(gameState.bet * 1.5) : gameState.bet)}`}`)
            .addFields(
                { name: `👤 Oyuncu (${playerScore})`, value: gameState.playerHand.map(c => `\`${c.value}${c.suit}\``).join(' '), inline: true },
                { name: `🕴️ Krupiye (${dealerScore})`, value: dealerCards, inline: true }
            );

        return { embeds: [embed], components: [] };
    } else {
        // Oyun devam ediyor, krupiyenin 2. kartı gizli
        const dealerCards = `\`${gameState.dealerHand[0].value}${gameState.dealerHand[0].suit}\` \`??\``;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: `${user.username} vs Krupiye`, iconURL: user.displayAvatarURL() })
            .setDescription(`Bahis: **${gameState.bet}**`)
            .addFields(
                { name: `👤 Oyuncu (${playerScore})`, value: gameState.playerHand.map(c => `\`${c.value}${c.suit}\``).join(' '), inline: true },
                { name: `🕴️ Krupiye (?)`, value: dealerCards, inline: true }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit (Kart)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand (Dur)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bj_double').setLabel('Double (2x)').setStyle(ButtonStyle.Danger).setDisabled(gameState.playerHand.length > 2)
            );

        return { embeds: [embed], components: [row] };
    }
}
