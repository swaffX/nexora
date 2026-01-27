const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('Crash (Aviator) oyunu: Grafik yükselirken paranı çek!')
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
            if (isNaN(amount) || amount < 50) return interaction.reply({ content: '❌ Min 50 NexCoin.', flags: MessageFlags.Ephemeral });
        }

        // Bakiye Düş (Atomik)
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // OYUN BAŞLIYOR
        // Crash Noktası Hesapla
        // Formül: E = 0.99 / (1 - U) where U is uniform random [0,1)
        // Instant Crash ihtimali (%1) de var.
        let multiplier = 1.0;
        const crashPoint = Math.max(1.00, (100 / (Math.floor(Math.random() * 100) + 1)) * 0.99); // Basitleştirilmiş crash algoritması

        let crashed = false;
        let cashedOut = false;
        let msg = null;

        // Görsel Setup
        const generateEmbed = (currentMult, status) => {
            let color = '#3498db'; // Mavi (Yükseliyor)
            let title = `🚀 CRASH: ${currentMult.toFixed(2)}x`;
            let desc = 'Yükseliyor... Paranızı çekmek için butona basın!';

            if (status === 'crashed') {
                color = '#e74c3c'; // Kırmızı
                title = `💥 CRASHED @ ${currentMult.toFixed(2)}x`;
                desc = 'Uçak düştü! Geç kaldın...';
            } else if (status === 'cashed') {
                color = '#2ecc71'; // Yeşil
                title = `💰 ÇEKİLDİ @ ${currentMult.toFixed(2)}x`;
                desc = `Tebrikler! ${Math.floor(amount * currentMult)} NexCoin kazandın.`;
            }

            // Grafik Temsili (String ile)
            const height = Math.min(10, Math.floor(currentMult));
            const graph = '📈 ' + '_'.repeat(height) + '🚀';

            return new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(`${desc}\n\n${graph}`)
                .setFooter({ text: `Bahis: ${amount}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('crash_cashout').setLabel('Nakit Çek 💰').setStyle(ButtonStyle.Success)
        );

        msg = await interaction.reply({ embeds: [generateEmbed(1.0, 'running')], components: [row], fetchReply: true });

        // Oyun Loop'u
        const intervalTime = 1500; // 1.5 saniyede bir güncelle (Discord rate limit için)
        let interval = setInterval(async () => {
            if (crashed || cashedOut) {
                clearInterval(interval);
                return;
            }

            // Çarpanı artır (Logaritmik değil basitleştirilmiş lineer artış şimdilik)
            // Daha heyecanlı olması için artış hızı zamanla artabilir
            if (multiplier < 2.0) multiplier += 0.2;
            else if (multiplier < 5.0) multiplier += 0.5;
            else multiplier += 1.0;

            if (multiplier >= crashPoint) {
                crashed = true;
                multiplier = crashPoint; // Tam crash noktasında göster
                clearInterval(interval);

                // Mesaj güncelle (Butonları kaldır)
                try {
                    await msg.edit({ embeds: [generateEmbed(multiplier, 'crashed')], components: [] });
                } catch (e) { } // Mesaj silinmiş olabilir
                return;
            }

            // Update Message
            try {
                await msg.edit({ embeds: [generateEmbed(multiplier, 'running')] });
            } catch (e) { clearInterval(interval); }

        }, intervalTime);

        // Buton Dinleyici
        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: 'Bu senin oyunun değil!', flags: MessageFlags.Ephemeral });

            if (!crashed && !cashedOut) {
                cashedOut = true;
                clearInterval(interval); // Loop'u durdur

                const winAmount = Math.floor(amount * multiplier);

                // Parayı Ver
                await User.findOneAndUpdate(
                    { odasi: userId, odaId: guildId },
                    { $inc: { balance: winAmount } }
                );

                await i.update({ embeds: [generateEmbed(multiplier, 'cashed')], components: [] });

                // Quest
                try {
                    const { updateQuestProgress } = require('../../utils/questManager');
                    await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
                } catch (e) { }
            }
        });
    }
};
