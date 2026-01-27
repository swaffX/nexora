const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

const HORSES = [
    { name: 'Gülbatur', icon: '🐎' },
    { name: 'Şahbatur', icon: '🦄' },
    { name: 'Rüzgar', icon: '🦓' },
    { name: 'Fırtına', icon: '🐂' },
    { name: 'Yıldırım', icon: '🐆' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horserace')
        .setDescription('At yarışı oynayarak bahis yap!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('at')
                .setDescription('Hangi ata oynuyorsun? (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)),

    async execute(interaction) {
        const amountInput = interaction.options.getString('bahis');
        const horseChoice = interaction.options.getInteger('at'); // Modal'dan veya komuttan gelir

        // Validasyon: At seçimi geçerli mi?
        if (!horseChoice || isNaN(horseChoice) || horseChoice < 1 || horseChoice > 5) {
            return interaction.reply({ content: '❌ Lütfen 1 ile 5 arasında geçerli bir at numarası girin.', flags: MessageFlags.Ephemeral });
        }

        const horseIndex = horseChoice - 1;
        const selectedHorse = HORSES[horseIndex];

        // Kullanıcı Kontrol
        let userCheck = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!userCheck) return interaction.reply({ content: '❌ Hesabınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(amountInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(amountInput);
            if (isNaN(amount) || amount < 100) {
                return interaction.reply({ content: '❌ Geçersiz miktar. Minimum 100 olmalı.', flags: MessageFlags.Ephemeral });
            }
        }

        // 1. Bakiye Kontrol (Atomik)
        const user = await User.findOneAndUpdate(
            { odasi: interaction.user.id, odaId: interaction.guild.id, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) {
            return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });
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
                    if (finished && i === winnerIndex) {
                        track += `🏁|${HORSES[i].icon} **${HORSES[i].name}** (🏆 KAZANDI!)\n`;
                    } else {
                        track += `🏁|${HORSES[i].icon} **${HORSES[i].name}**\n`;
                    }
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
                // Her at her turda 1 ile 6 birim arası rastgele ilerler (Tam şans)
                const move = Math.floor(Math.random() * 6) + 1;
                positions[i] += move / 2; // Görsel ölçekleme
            }

            // Bitiş Kontrolü (Hepsini hareket ettirdikten sonra)
            const finishers = positions.map((pos, index) => ({ pos, index })).filter(p => p.pos >= trackLength);

            if (finishers.length > 0) {
                // En uzağa gideni bul (Beraberlik çözümü)
                // Sort descending by position
                finishers.sort((a, b) => b.pos - a.pos);

                // Eğer tam eşitlik varsa rastgele birini seç
                const topPos = finishers[0].pos;
                const topHorses = finishers.filter(f => f.pos === topPos);
                const winner = topHorses[Math.floor(Math.random() * topHorses.length)]; // Random pick if tie

                winnerIndex = winner.index;
                finished = true;
            }

            const newTrack = generateTrack();
            embed.setDescription(newTrack);

            if (finished) {
                clearInterval(interval);

                let resultText = '';
                const winMultiplier = 3; // 3x Ödül (Daha dengeli)

                if (winnerIndex === horseIndex) {
                    const prize = amount * winMultiplier;
                    // Ödülü Ver (Atomik)
                    await User.findOneAndUpdate(
                        { odasi: interaction.user.id, odaId: interaction.guild.id },
                        { $inc: { balance: prize } }
                    );
                    user.balance += prize; // Görüntü

                    embed.setColor('#2ecc71'); // Green
                    resultText = `🎉 **TEBRİKLER!** Senin atın **${HORSES[winnerIndex].name}** kazandı!\n💰 **Kazanılan:** ${prize} NexCoin (x3)`;
                } else {
                    embed.setColor('#e74c3c'); // Red
                    resultText = `❌ **KAYBETTİN...** Kazanan: **${HORSES[winnerIndex].name}**\nParan gitti...`;
                }

                embed.addFields({ name: 'Sonuç', value: resultText });
                await interaction.editReply({ embeds: [embed] });

                // Quest Update
                try {
                    const { updateQuestProgress } = require('../../utils/questManager');
                    await updateQuestProgress({ odasi: interaction.user.id, odaId: interaction.guild.id }, 'gamble', 1);
                } catch (e) { console.error(e); }

            } else {
                await interaction.editReply({ embeds: [embed] });
            }
        }, 1500); // 1.5 saniyede bir güncelle
    }
};
