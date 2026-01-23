const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../../shared/models/User');

const HORSES = [
    { name: 'Gülbatur', icon: '🐎', speed: { min: 4, max: 9 } },
    { name: 'Şahbatur', icon: '🦄', speed: { min: 3, max: 10 } },
    { name: 'Rüzgar', icon: '🦓', speed: { min: 5, max: 8 } },
    { name: 'Fırtına', icon: '🐂', speed: { min: 2, max: 12 } },
    { name: 'Yıldırım', icon: '🐆', speed: { min: 6, max: 7 } } // Stabil
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horserace')
        .setDescription('At yarışı oynayarak bahis yap!')
        .addIntegerOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı')
                .setRequired(true)
                .setMinValue(100))
        .addIntegerOption(option =>
            option.setName('at')
                .setDescription('Hangi ata oynuyorsun? (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)),

    async execute(interaction) {
        const amount = interaction.options.getInteger('bahis');
        const horseIndex = interaction.options.getInteger('at') - 1;
        const selectedHorse = HORSES[horseIndex];

        // 1. Bakiye Kontrol (Atomik)
        const user = await User.findOneAndUpdate(
            { odasi: interaction.user.id, odaId: interaction.guild.id, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            return interaction.reply({ content: '❌ Yetersiz bakiye!', ephemeral: true });
        }

        // Yarış Hazırlığı
        const trackLength = 40;
        let positions = [0, 0, 0, 0, 0];
        let finished = false;
        let winnerIndex = -1;

        const generateTrack = () => {
            let track = '';
            for (let i = 0; i < HORSES.length; i++) {
                const spaces = Math.floor(positions[i]);
                const remaining = trackLength - spaces;

                // Finish çizgisi kontrolü
                if (spaces >= trackLength) {
                    track += `🏁|${HORSES[i].icon} **${HORSES[i].name}** (KAZANDI!)\n`;
                } else {
                    track += `🏁|${'-'.repeat(spaces)}${HORSES[i].icon}${'.'.repeat(Math.max(0, remaining - 1))}|🚩 **${HORSES[i].name}**\n`;
                }
            }
            return track;
        };

        const embed = new EmbedBuilder()
            .setColor('#e67e22') // Orange
            .setTitle('🐎 At Yarışı Başladı! 🐎')
            .setDescription(generateTrack())
            .setFooter({ text: `Bahsin: ${amount} coin -> ${selectedHorse.name}` });

        const msg = await interaction.reply({ embeds: [embed], withResponse: true });

        // Yarış Döngüsü
        const interval = setInterval(async () => {
            if (finished) return;

            // Atları hareket ettir
            for (let i = 0; i < HORSES.length; i++) {
                const move = Math.random() * (HORSES[i].speed.max - HORSES[i].speed.min) + HORSES[i].speed.min;
                positions[i] += move / 2; // Hızı dengele

                if (positions[i] >= trackLength && winnerIndex === -1) {
                    winnerIndex = i;
                    finished = true;
                }
            }

            const newTrack = generateTrack();
            embed.setDescription(newTrack);

            if (finished) {
                clearInterval(interval);

                let resultText = '';
                const winMultiplier = 5; // 5 At var, risk yüksek, x5 ödül.

                if (winnerIndex === horseIndex) {
                    const prize = amount * winMultiplier;
                    // Ödülü Ver (Atomik)
                    await User.findOneAndUpdate(
                        { odasi: interaction.user.id, odaId: interaction.guild.id },
                        { $inc: { balance: prize } }
                    );
                    user.balance += prize; // Görüntü

                    embed.setColor('#2ecc71'); // Green
                    resultText = `🎉 **TEBRİKLER!** Senin atın **${HORSES[winnerIndex].name}** kazandı!\n💰 **Kazanılan:** ${prize} NexCoin`;
                } else {
                    embed.setColor('#e74c3c'); // Red
                    resultText = `❌ **KAYBETTİN...** Kazanan: **${HORSES[winnerIndex].name}**\nParan gitti...`;
                }

                embed.addFields({ name: 'Sonuç', value: resultText });
                await msg.edit({ embeds: [embed] });

            } else {
                await msg.edit({ embeds: [embed] });
            }
        }, 1500); // 1.5 saniyede bir güncelle
    }
};
