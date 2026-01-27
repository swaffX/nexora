const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const MULTIPLIERS = [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plinko')
        .setDescription('Plinko: Topu bırak, çarpanı yakala!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true)),

    async execute(interaction) {
        // Bahis Miktarını Al (Modal veya Slash Command)
        let betInput;
        if (interaction.isButton && interaction.customId.startsWith('plinko_replay_')) {
            betInput = interaction.customId.split('_')[2];
        } else {
            betInput = interaction.options.getString('bahis');
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Kullanıcı Kontrolü
        let userCheck = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userCheck) {
            const msg = { content: '❌ Kaydınız yok.', flags: MessageFlags.Ephemeral };
            if (interaction.isButton) return interaction.reply(msg); // Button cannot use ephemeral easily if deferred? Actually it can.
            return interaction.reply(msg);
        }

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount)) {
                return interaction.reply({ content: '❌ Geçersiz miktar.', flags: MessageFlags.Ephemeral });
            }
        }

        if (amount <= 0) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });
        if (amount < 20) return interaction.reply({ content: '❌ Min 20 NexCoin.', flags: MessageFlags.Ephemeral });

        // Bakiyeyi Düş (Atomic)
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // --- HESAPLAMA ---
        // Rotayı önceden belirle
        // 8 Satır. Sağ (1) veya Sol (0).
        let currentPos = 0; // Current index in the current row
        const pathSteps = []; // Her satırdaki topun konumu

        for (let row = 0; row < 8; row++) {
            // row 0: 1 pin (pos 0)
            // row 1: 2 pins (pos 0, 1)
            // Her düşüşte ya index aynı kalır (Sol) ya da 1 artar (Sağ)
            const move = Math.random() < 0.5 ? 0 : 1;
            currentPos += move;
            pathSteps.push(currentPos);
        }

        // Sonuç (Son satırdaki index = bucket index)
        const multiplier = MULTIPLIERS[currentPos];
        const winAmount = Math.floor(amount * multiplier);

        // --- GÖRSELLEŞTİRME FONKSİYONU ---
        const generateBoard = (activeRow, activePos) => {
            let str = '';
            // 8 Satır Pin (0..7) + 1 Satır Bucket (8)
            // Biz sadece pinleri ve düşen topu gösteriyoruz

            for (let r = 0; r <= 8; r++) {
                let line = '';
                // Boşluk (Piramit Görüntüsü için) - Discord'da tam hizalamak zor ama deneyelim
                // line += ' '.repeat((8 - r) * 2); 

                // Pinler
                // r. satırda r+1 tane pin var
                for (let c = 0; c <= r; c++) {
                    if (r === activeRow && c === activePos) {
                        line += '🔴 '; // Top
                    } else {
                        line += '🔵 '; // Pin
                    }
                }
                str += line + '\n';
            }
            return str;
        };

        // --- OYUN BAŞLIYOR ---
        // İlk mesaj (Henüz düşmedi, Row 0, Pos 0 da top var)
        // Rate limit yememek için 2'şer satır atlayarak editleyeceğiz.

        const initialEmbed = new EmbedBuilder()
            .setTitle('🎯 PLINKO')
            .setDescription(`Bahis: **${amount}** NexCoin\n\n${generateBoard(0, 0)}\n**Çarpan:** ...`)
            .setColor('#3498db');

        // Yanıt veya Update
        let msg;
        if (interaction.isButton && interaction.isButton()) { // Replay button
            await interaction.update({ embeds: [initialEmbed], components: [] });
            msg = await interaction.fetchReply(); // fetch original message
        } else {
            await interaction.reply({ embeds: [initialEmbed] });
            msg = await interaction.fetchReply();
        }

        // --- ANİMASYON DÖNGÜSÜ ---
        // pathSteps: [satır 1 pos, satır 2 pos, ...]
        // Satır 0 zaten çizildi.

        const delay = (ms) => new Promise(res => setTimeout(res, ms));

        // Adım adım düşür (0, 2, 4, 6, 8. satırları göstererek)
        // Discord edit rate limit: 5/5s. Yani 1s arayla yaparsak sorun olmaz.
        // Hızlı hissettirmek için 2 satır atlayalım.

        for (let r = 2; r <= 8; r += 2) {
            await delay(1200); // 1.2 sn bekle

            // Hangi pozisyondayız?
            // pathSteps[r-1] contains pos for row r.
            // Wait, pathSteps index 0 is result after falling FROM row 0 TO row 1.
            // So pathSteps[0] is pos at row 1.
            // pathSteps[r-1] is pos at row r.

            const pos = r === 0 ? 0 : pathSteps[r - 1];

            const frameEmbed = new EmbedBuilder()
                .setTitle('🎯 PLINKO')
                .setDescription(`Bahis: **${amount}** NexCoin\n\n${generateBoard(r, pos)}\n**Çarpanlar:** [ ${MULTIPLIERS.join(' | ')} ]`)
                .setColor('#3498db');

            await interaction.editReply({ embeds: [frameEmbed] });
        }

        // --- BİTİŞ ---
        await delay(500);

        let resultBar = '';
        for (let i = 0; i < MULTIPLIERS.length; i++) {
            if (i === currentPos) resultBar += '📍';
            else resultBar += '➖';
        }

        const finalEmbed = new EmbedBuilder()
            .setTitle(multiplier > 1 ? '🎉 KAZANDIN!' : '❌ ŞANSINA KÜS')
            .setColor(multiplier > 1 ? '#2ecc71' : '#e74c3c')
            .setDescription(`Bahis: **${amount}** NexCoin\n\n${generateBoard(8, currentPos)}\n` +
                `**Çarpanlar:**\n[ ${MULTIPLIERS.join(' | ')} ]\n${resultBar}\n\n` +
                `Sonuç: **${multiplier}x**\n` +
                (winAmount > 0 ? `💰 **+${winAmount}** NexCoin Kazandın!` : `💸 ${amount} NexCoin Kaybettin.`));

        // Replay Butonu
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`plinko_replay_${amount}`)
                .setLabel('Tekrar Oyna')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔁')
        );

        if (winAmount > 0) {
            await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmount } });
        }

        await interaction.editReply({ embeds: [finalEmbed], components: [row] });

        // Quest Update
        try {
            const { updateQuestProgress } = require('../../utils/questManager');
            await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
        } catch (e) { }

        // REPLAY COLLECTOR
        // Butona basıldığında yeni bir instance başlatmak yerine
        // interactionCreate'den global olarak yakalamak daha iyi ama 
        // burada basitçe collector kurup recursive çağırabiliriz veya
        // interactionCreate'e logic ekleyebiliriz.
        // En temizi: interactionCreate.js de 'plinko_replay' kontrolü yapmak.
        // Ama şimdilik hızlı çözüm: Bu dosyanın başında replay check var.
        // interactionCreate'e gitmemiz lazım çünkü yeni bir interaction başlayacak.
        // Sadece CustomID 'plinko_replay_AMOUNT' olsun. interactionCreate bunu parse Edip execute'u tekrar çağırsın.
    }
};
