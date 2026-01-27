const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bomb')
        .setDescription('Sıcak Patates! Bomba elinde patlayan kaybeder.')
        .addIntegerOption(option =>
            option.setName('bahis')
                .setDescription('Ortaya konacak bahis')
                .setRequired(true)
                .setMinValue(100))
        .addUserOption(option =>
            option.setName('rakip')
                .setDescription('Kime meydan okuyorsun?')
                .setRequired(true)),

    async execute(interaction) {
        const amount = interaction.options.getInteger('bahis');
        const opponent = interaction.options.getUser('rakip');
        const author = interaction.user;

        if (opponent.id === author.id) return interaction.reply({ content: 'Kendi kendine bomba atamazsın.', flags: MessageFlags.Ephemeral });
        if (opponent.bot) return interaction.reply({ content: 'Botlar bombadan anlamaz.', flags: MessageFlags.Ephemeral });

        const authorData = await User.findOne({ odasi: author.id, odaId: interaction.guild.id });
        if (!authorData || authorData.balance < amount) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        const opponentData = await User.findOne({ odasi: opponent.id, odaId: interaction.guild.id });
        if (!opponentData || opponentData.balance < amount) return interaction.reply({ content: '❌ Rakibinin parası yetmiyor.', flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('💣 BOMBA OYUNU')
            .setDescription(`<@${author.id}> sana **${amount}** NexCoin bahsine BOMBA atmak istiyor!\n\nKabul edersen bomba aktifleşecek. Elinde patlayan kaybeder!`)
            .setFooter({ text: 'Hızlı paslaşın...' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_bomb').setLabel('Kabul Et ve Başla').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('decline_bomb').setLabel('Korkuyorum').setStyle(ButtonStyle.Secondary)
        );

        // FIX: fetchReply
        await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            try {
                if (i.replied || i.deferred) return;

                if (i.user.id !== opponent.id) {
                    if (i.user.id === author.id && i.customId === 'decline_bomb') {
                        // OK
                    } else {
                        return i.reply({ content: 'Karışma, patlarsın.', flags: MessageFlags.Ephemeral });
                    }
                }

                if (i.customId === 'decline_bomb') {
                    collector.stop('declined');
                    return i.update({ content: '❌ Oyun iptal edildi.', embeds: [], components: [] });
                }

                if (i.customId === 'accept_bomb') {
                    collector.stop('accepted');
                    await i.deferUpdate();
                    startBombGame(msg, author, opponent, amount, interaction.guild.id);
                }
            } catch (e) { }
        });
    }
};

async function startBombGame(message, p1, p2, amount, guildId) {
    await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: -amount } });
    await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: -amount } });

    let turn = Math.random() < 0.5 ? p1.id : p2.id;
    const duration = Math.floor(Math.random() * 20000) + 10000;
    const startTime = Date.now();
    let isEnded = false;

    const players = {
        [p1.id]: p1,
        [p2.id]: p2
    };

    const updateGameMessage = async (reason = null) => {
        if (isEnded && reason !== 'boom') return; // Eğer bitmişse ve boom değilse çık

        if (reason === 'boom') {
            isEnded = true;
            const loserId = turn;
            const winnerId = turn === p1.id ? p2.id : p1.id;
            const winner = players[winnerId];
            const loser = players[loserId];
            const winAmount = amount * 2;

            await User.findOneAndUpdate({ odasi: winnerId, odaId: guildId }, { $inc: { balance: winAmount } });

            const boomEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('💥 BOOOOM! 💥')
                .setDescription(`💣 Bomba **<@${loserId}>**'in elinde patladı!\n\n💀 **Ölen:** <@${loserId}>\n🏆 **Hayatta Kalan:** <@${winnerId}>\n💰 **Kazanılan:** ${winAmount} NexCoin`)
                .setImage('https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif');

            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: winnerId, odaId: guildId }, 'gamble', 1);
            } catch (e) { }

            return message.edit({ content: `💥 OYUN BİTTİ!`, embeds: [boomEmbed], components: [] });
        }

        const currentHolder = players[turn];

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('💣 BOMBA SENDE!')
            .setDescription(`**<@${currentHolder.id}>**, acele et! Bomba her an patlayabilir!\n\n👇 **PASLA** butonuna basıp rakibine at!`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/112/112683.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('pass_bomb')
                .setLabel('💣 BOMBALI PASLA!')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💨')
        );

        await message.edit({ content: `⏱️ Tik tak... **Bomba şu an: <@${turn}>**`, embeds: [embed], components: [row] });
    };

    await updateGameMessage();

    const bombTimer = setTimeout(() => {
        if (!isEnded) {
            updateGameMessage('boom');
        }
    }, duration);

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 40000 });

    collector.on('collect', async btn => {
        try {
            if (btn.replied || btn.deferred) return;

            if (isEnded) return;

            if (btn.user.id !== turn) {
                return btn.reply({ content: 'Bomba sende değil ki! Sakin ol.', flags: MessageFlags.Ephemeral });
            }

            // FIX: Mutlaka ve hemen etkileşimi onayla
            await btn.deferUpdate();

            turn = turn === p1.id ? p2.id : p1.id;

            await updateGameMessage();
        } catch (e) { }
    });
}
