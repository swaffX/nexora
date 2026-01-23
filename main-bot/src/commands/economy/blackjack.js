const path = require('path');
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

// Kart Destesi
const suits = ['♠️', '♥️', '♦️', '♣️'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck.sort(() => Math.random() - 0.5); // Karıştır
}

function calculateHand(hand) {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) {
            score += 10;
        } else if (card.value === 'A') {
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

function formatHand(hand) {
    return hand.map(c => `\`${c.suit} ${c.value}\``).join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('21 Oyna (Blackjack)')
        .addIntegerOption(opt =>
            opt.setName('bahis')
                .setDescription('Bahis miktarı')
                .setMinValue(50)
                .setMaxValue(100000)
                .setRequired(true)),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bahis');
        const userData = await User.findOrCreate(interaction.user.id, interaction.guild.id, interaction.user.username);

        if (userData.balance < bet) {
            return interaction.reply({
                embeds: [embeds.error('Yetersiz Bakiye', `Bu bahis için **${(bet - userData.balance).toLocaleString()} NexCoin** eksiğiniz var.`)],
                ephemeral: true
            });
        }

        // Bahsi düş
        userData.balance -= bet;
        await userData.save();

        const deck = createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        let playerScore = calculateHand(playerHand);
        let dealerScore = calculateHand([dealerHand[0]]); // Sadece ilk kart görünür

        const generateEmbed = (isEnded = false) => {
            const embed = {
                title: '🃏 Blackjack',
                color: isEnded ? (playerScore > 21 ? 0xE74C3C : (dealerScore > 21 || playerScore > dealerScore ? 0x2ECC71 : 0xE74C3C)) : 0x3498DB,
                fields: [
                    {
                        name: `Senin Elin (${calculateHand(playerHand)})`,
                        value: formatHand(playerHand),
                        inline: true
                    },
                    {
                        name: `Krupiye (${isEnded ? calculateHand(dealerHand) : '?'})`,
                        value: isEnded ? formatHand(dealerHand) : `\`${dealerHand[0].suit} ${dealerHand[0].value}\` \`🟥 ?\``,
                        inline: true
                    },
                    {
                        name: 'Bahis',
                        value: `💰 ${bet.toLocaleString()}`,
                        inline: false
                    }
                ],
                footer: { text: `Nexora Casino • ${interaction.user.username}` }
            };

            if (isEnded) {
                const finalPlayerScore = calculateHand(playerHand);
                const finalDealerScore = calculateHand(dealerHand);

                let resultText = '';
                if (finalPlayerScore > 21) resultText = '💥 Patladın! Kaybettin.';
                else if (finalDealerScore > 21) resultText = '🎉 Krupiye Patladı! KAZANDIN!';
                else if (finalPlayerScore > finalDealerScore) resultText = '🎉 Tebrikler! KAZANDIN!';
                else if (finalPlayerScore === finalDealerScore) resultText = '🤝 Berabere (İade)';
                else resultText = '💀 Kaybettin...';

                embed.description = `**${resultText}**`;
            }

            return embed;
        };

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Kart Çek').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Dur').setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.reply({
            embeds: [generateEmbed()],
            components: [buttons],
            fetchReply: true
        });

        // Blackjack kontrolü (İlk elden)
        if (playerScore === 21) {
            const winAmount = Math.floor(bet * 2.5); // Blackjack 3:2 öder (burada 2.5x toplam)
            userData.balance += winAmount;
            await userData.save();

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: interaction.user.id, odaId: interaction.guild.id }, 'gamble', 1);
            } catch (e) { }

            return interaction.editReply({
                embeds: [{
                    title: '🃏 Blackjack! 🔥',
                    description: `**MUHTEŞEM! Blackjack yaptın!**\nKazanç: **${winAmount.toLocaleString()} NexCoin**`,
                    color: 0xF1C40F
                }],
                components: []
            });
        }

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'bj_hit') {
                playerHand.push(deck.pop());
                playerScore = calculateHand(playerHand);

                if (playerScore > 21) {
                    collector.stop('bust');
                } else {
                    await i.update({ embeds: [generateEmbed()] });
                }
            } else if (i.customId === 'bj_stand') {
                collector.stop('stand');
            }
        });

        collector.on('end', async (_, reason) => {
            let finalDealerScore = calculateHand(dealerHand);

            // Eğer oyuncu patlamadıysa, krupiye oynar
            if (reason === 'stand') {
                while (finalDealerScore < 17) {
                    dealerHand.push(deck.pop());
                    finalDealerScore = calculateHand(dealerHand);
                }
            }

            const finalPlayerScore = calculateHand(playerHand);
            let winAmount = 0;

            if (finalPlayerScore > 21) {
                // Kayıp (Zaten düşüldü)
            } else if (finalDealerScore > 21 || finalPlayerScore > finalDealerScore) {
                // Kazanma (2x)
                winAmount = bet * 2;
            } else if (finalPlayerScore === finalDealerScore) {
                // Beraberlik (İade)
                winAmount = bet;
            }

            if (winAmount > 0) {
                userData.balance += winAmount;
                await userData.save();
            }

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: interaction.user.id, odaId: interaction.guild.id }, 'gamble', 1);
            } catch (e) { }

            await interaction.editReply({
                embeds: [generateEmbed(true)],
                components: []
            });
        });
    }
};
