const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('rps').setDescription('Bot ile Taş Kağıt Makas oyna!'),
    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setEmoji('🪨').setLabel('Taş').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rps_paper').setEmoji('📄').setLabel('Kağıt').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rps_scissors').setEmoji('✂️').setLabel('Makas').setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('✌️ Taş Kağıt Makas')
            .setDescription('Hamleni seçmek için butonlara tıkla!');

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('rps_');

        try {
            const confirmation = await msg.awaitMessageComponent({ filter, time: 30000 });

            const moves = ['rock', 'paper', 'scissors'];
            const botMove = moves[Math.floor(Math.random() * 3)];
            const userMove = confirmation.customId.split('_')[1];

            const map = { rock: '🪨 Taş', paper: '📄 Kağıt', scissors: '✂️ Makas' };

            let result;
            let color = 0x3498DB;

            if (userMove === botMove) {
                result = '🤝 Berabere!';
                color = 0xF1C40F;
            } else if (
                (userMove === 'rock' && botMove === 'scissors') ||
                (userMove === 'paper' && botMove === 'rock') ||
                (userMove === 'scissors' && botMove === 'paper')
            ) {
                result = '🎉 Kazandın!';
                color = 0x2ECC71;
            } else {
                result = '🤖 Kaybettin!';
                color = 0xE74C3C;
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(result)
                .addFields(
                    { name: 'Sen', value: map[userMove], inline: true },
                    { name: 'Bot', value: map[botMove], inline: true }
                );

            await confirmation.update({ embeds: [resultEmbed], components: [] });

        } catch (e) {
            await interaction.editReply({ content: '⏰ Süre doldu!', embeds: [], components: [] });
        }
    }
};
