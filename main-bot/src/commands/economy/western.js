const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('western')
        .setDescription('Vahşi Batı düellosu! Hızlı olan kazanır.')
        .addIntegerOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı')
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

        if (opponent.id === author.id) return interaction.reply({ content: 'Kendinle düello atamazsın kovboy. 🤠', flags: MessageFlags.Ephemeral });
        if (opponent.bot) return interaction.reply({ content: 'Botlarla düello atamazsın.', flags: MessageFlags.Ephemeral });

        // Bakiye Kontrolü
        const authorData = await User.findOne({ odasi: author.id, odaId: interaction.guild.id });
        if (!authorData || authorData.balance < amount) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        const opponentData = await User.findOne({ odasi: opponent.id, odaId: interaction.guild.id });
        if (!opponentData || opponentData.balance < amount) return interaction.reply({ content: '❌ Rakibinin parası yetmiyor.', flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('🤠 Vahşi Batı Düellosu')
            .setDescription(`<@${author.id}>, <@${opponent.id}> kişisine **${amount}** NexCoin bahsine meydan okudu!\n\nKabul ediyor musun?`)
            .setFooter({ text: 'Kabul ederseniz oyun başlayacak. Hızlı olan kazanır!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_duel').setLabel('Kabul Et').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('decline_duel').setLabel('Reddet').setStyle(ButtonStyle.Danger)
        );

        // FIX: fetchReply yerine ayrı çağrı
        await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            try {
                if (i.replied || i.deferred) return;

                if (i.user.id !== opponent.id) {
                    if (i.user.id === author.id && i.customId === 'decline_duel') {
                        // OK
                    } else {
                        return i.reply({ content: 'Bu düello senin için değil.', flags: MessageFlags.Ephemeral });
                    }
                }

                if (i.customId === 'decline_duel') {
                    collector.stop('declined');
                    return i.update({ content: '❌ Düello reddedildi veya iptal edildi.', embeds: [], components: [] });
                }

                if (i.customId === 'accept_duel') {
                    collector.stop('accepted');
                    await i.deferUpdate();
                    startGame(msg, author, opponent, amount, interaction.guild.id);
                }
            } catch (e) { console.error(e); }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                msg.edit({ content: '⏰ Süre doldu, düello iptal.', components: [] }).catch(() => { });
            }
        });
    }
};

async function startGame(message, p1, p2, amount, guildId) {
    await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: -amount } });
    await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: -amount } });

    let gameState = 'waiting';

    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🤠 HAZIRLANIN...')
        .setDescription(`Sırt sırta verdiniz... 3 adım atın...\n\n**Silahına davranma!** 🔥 butonu çıkınca BAS!\n\n*(Erken basarsan, silahın tutukluk yapar ve kaybedersin)*`);

    const waitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('shoot').setLabel('✋ Bekle...').setStyle(ButtonStyle.Secondary).setDisabled(false)
    );

    await message.edit({ content: `🔫 <@${p1.id}> vs <@${p2.id}>`, embeds: [embed], components: [waitRow] });

    const delay = Math.floor(Math.random() * 5000) + 3000;

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

    let fireTimeout = setTimeout(async () => {
        if (gameState === 'ended') return;
        gameState = 'fire';

        const fireEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🔥 ATEŞ ET! 🔥')
            .setDescription('**ŞİMDİ BAS! HIZLI OLAN KAZANIR!**');

        const fireRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shoot').setLabel('🔥 ATEŞ ET!').setStyle(ButtonStyle.Danger).setEmoji('🔫')
        );

        await message.edit({ embeds: [fireEmbed], components: [fireRow] }).catch(() => { });
    }, delay);


    collector.on('collect', async btn => {
        try {
            if (btn.replied || btn.deferred) return; // Güvenlik

            if (btn.user.id !== p1.id && btn.user.id !== p2.id) return btn.reply({ content: 'Kenardan izle evlat.', flags: MessageFlags.Ephemeral });

            // FIX: Mutlaka etkileşimi onayla
            await btn.deferUpdate();

            if (gameState === 'ended') return;

            // 1. ERKEN BASMA (PENALTY)
            if (gameState === 'waiting') {
                gameState = 'ended';
                clearTimeout(fireTimeout);
                collector.stop();

                const loser = btn.user;
                const winner = btn.user.id === p1.id ? p2 : p1;

                return endGame(message, winner, loser, amount, guildId, 'early_fail');
            }

            // 2. DOĞRU ZAMAN (FIRE)
            if (gameState === 'fire') {
                gameState = 'ended';
                collector.stop();

                const winner = btn.user;
                const loser = btn.user.id === p1.id ? p2 : p1;

                return endGame(message, winner, loser, amount, guildId, 'hit');
            }
        } catch (e) {
            if (e.code !== 'InteractionCollectorError') console.error(e);
        }
    });
}

async function endGame(message, winner, loser, amount, guildId, type) {
    const winAmount = amount * 2;
    await User.findOneAndUpdate({ odasi: winner.id, odaId: guildId }, { $inc: { balance: winAmount } });

    const embed = new EmbedBuilder()
        .setColor('#2ecc71');

    if (type === 'early_fail') {
        embed.setTitle('💥 SİLAH TUTUKLUK YAPTI!')
            .setDescription(`<@${loser.id}> heyecanına yenik düşüp erken davrandı!\n\n🏆 **Kazanan:** <@${winner.id}>\n💰 **Kazanılan:** ${winAmount} NexCoin`);
    } else {
        embed.setTitle('🔫 BAM! HEDEF VURULDU!')
            .setDescription(`**<@${winner.id}>** inanılmaz bir refleksle rakibini indirdi!\n\n💀 <@${loser.id}> çok yavaştı...\n🏆 **Kazanan:** <@${winner.id}>\n💰 **Kazanılan:** ${winAmount} NexCoin`);
    }

    await message.edit({ content: `🎉 Kazanan: <@${winner.id}>`, embeds: [embed], components: [] });

    // Quest
    try {
        const { updateQuestProgress } = require('../../utils/questManager');
        await updateQuestProgress({ odasi: winner.id, odaId: guildId }, 'gamble', 1);
    } catch (e) { }
}
