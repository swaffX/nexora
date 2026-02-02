const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Taş Kağıt Makas: Bota karşı oyna, kazan!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı (veya \'all\')')
                .setRequired(true))
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
        // ROL KONTROLÜ (1463875340513317089)
        const { PermissionsBitField } = require('discord.js');
        const ALLOWED_ROLE_ID = '1463875340513317089';

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için gerekli **Casino Erişim Rolüne** sahip değilsiniz.', flags: MessageFlags.Ephemeral });
        }

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
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('✂️ TAŞ KAĞIT MAKAS')
            .setDescription(`Bahis: **${amount}** NexCoin\n\nSeçimini yap!`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('Taş').setStyle(ButtonStyle.Primary).setEmoji('🪨'),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('Kağıt').setStyle(ButtonStyle.Primary).setEmoji('📃'),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('Makas').setStyle(ButtonStyle.Primary).setEmoji('✂️')
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000
        });

        collector.on('collect', async i => {
            const userChoice = i.customId.split('_')[1]; // rock, paper, scissors
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            const emojiMap = { 'rock': '🪨', 'paper': '📃', 'scissors': '✂️' };
            const nameMap = { 'rock': 'TAŞ', 'paper': 'KAĞIT', 'scissors': 'MAKAS' };

            // Kazananı Belirle
            let result = 'draw';
            if (userChoice === botChoice) result = 'draw';
            else if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'win';
            } else {
                result = 'lose';
            }

            let resultText = '';
            let endColor = '';

            if (result === 'win') {
                const winAmount = amount * 2;
                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmount } });
                resultText = `🎉 **KAZANDIN!**\n\nSen: ${emojiMap[userChoice]} vs Bot: ${emojiMap[botChoice]}\n💰 **+${winAmount}** NexCoin`;
                endColor = '#2ecc71';
            } else if (result === 'draw') {
                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: amount } }); // İade
                resultText = `🤝 **BERABERE!**\n\nSen: ${emojiMap[userChoice]} vs Bot: ${emojiMap[botChoice]}\nParan iade edildi.`;
                endColor = '#95a5a6';
            } else {
                resultText = `💀 **KAYBETTİN...**\n\nSen: ${emojiMap[userChoice]} vs Bot: ${emojiMap[botChoice]}\nBot seni yendi!`;
                endColor = '#e74c3c';
            }

            const endEmbed = new EmbedBuilder()
                .setTitle('✂️ Sonuç')
                .setColor(endColor)
                .setDescription(resultText);

            await i.update({ embeds: [endEmbed], components: [] });
            collector.stop();

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: userId, odaId: guildId }, 'gamble', 1);
            } catch (e) { }
        });
    }
};
