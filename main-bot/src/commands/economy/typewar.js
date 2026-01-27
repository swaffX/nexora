const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

const SENTENCES = [
    "Şu köşe yaz köşesi, şu köşe kış köşesi, ortada su şişesi.",
    "Bir berber bir berbere gel beraber bir berber dükkanı açalım demiş.",
    "Kartal kalkar dal sarkar, dal sarkar kartal kalkar.",
    "Al bu takatukaları takatukacıya takatukalatmaya götür.",
    "Üç tunç tas has hoşaf.",
    "Dal sarkar kartal kalkar, kartal kalkar dal sarkar.",
    "Elalem bir ala dana aldı aladanalandı da biz bir ala dana alıp aladanalanamadık.",
    "Kırk küp kırkının da kulpu kırık küp.",
    "Nexora sunucusu Discord'un en kral sunucusudur.",
    "Hızlı koşan atın nalı seyrek düşer.",
    "Damlaya damlaya göl olur, taşıma suyla değirmen dönmez.",
    "Bugün hava çok güzel ama kod yazmak daha güzel.",
    "Javascript asenkron çalışan tek iş parçacıklı bir dildir.",
    "Klavyesi güçlü olanın bileği bükülmez.",
    "Beş yüz elli beş şişe şam şuruşu."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('typewar')
        .setDescription('Klavye savaşı! En hızlı ve doğru yazan kazanır.')
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

        if (opponent.id === author.id) return interaction.reply({ content: 'Kendi kendine yarışamazsın.', flags: MessageFlags.Ephemeral });
        if (opponent.bot) return interaction.reply({ content: 'Botlar senden hızlı yazar.', flags: MessageFlags.Ephemeral });

        // Bakiye Kontrolü
        const authorData = await User.findOne({ odasi: author.id, odaId: interaction.guild.id });
        if (!authorData || authorData.balance < amount) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        const opponentData = await User.findOne({ odasi: opponent.id, odaId: interaction.guild.id });
        if (!opponentData || opponentData.balance < amount) return interaction.reply({ content: '❌ Rakibinin parası yetmiyor.', flags: MessageFlags.Ephemeral });

        // Davet
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('⌨️ KELİME SAVAŞI')
            .setDescription(`<@${author.id}>, <@${opponent.id}> ile **${amount}** NexCoin bahsine KLAVYE DÜELLOSU yapmak istiyor!\n\nVerilen cümleyi **HATASIZ** ve **İLK** yazan kazanır!`)
            .setFooter({ text: 'Parmakları ısıtın...' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_type').setLabel('Kabul Et').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('decline_type').setLabel('Reddet').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== opponent.id) {
                if (i.user.id === author.id && i.customId === 'decline_type') { }
                else return i.reply({ content: 'Bu düello senin için değil.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'decline_type') {
                collector.stop('declined');
                return i.update({ content: '❌ Düello reddedildi.', embeds: [], components: [] });
            }

            if (i.customId === 'accept_type') {
                collector.stop('accepted');
                await i.deferUpdate();
                startTypeGame(msg, author, opponent, amount, interaction.guild.id, interaction.channel);
            }
        });
    }
};

async function startTypeGame(message, p1, p2, amount, guildId, channel) {
    // Paraları Kes
    await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: -amount } });
    await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: -amount } });

    // Rastgele Cümle Seç
    // Cümleyi biraz "Invisible Character" (Zero Width Space) ile modifiye edelim ki Copy-Paste zorlaşsın mı? 
    // Şimdilik hayır, normal kullanıcıyı bezdirir.
    const targetSentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];

    // Geri Sayım
    await message.edit({ content: 'HAZIRLANIN...', embeds: [], components: [] });

    setTimeout(async () => { await message.edit({ content: '3...' }); }, 1000);
    setTimeout(async () => { await message.edit({ content: '2...' }); }, 2000);
    setTimeout(async () => { await message.edit({ content: '1...' }); }, 3000);

    setTimeout(async () => {
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🔥 YAZ BAKALIM! 🔥')
            .setDescription(`Aşağıdaki cümleyi **AYNEN** yaz:\n\n\`${targetSentence}\``); // Code block içinde göster

        await message.edit({ content: `✍️ **BAŞLA!** <@${p1.id}> vs <@${p2.id}>`, embeds: [embed] });

        // Message Collector Başlat
        const filter = m => (m.author.id === p1.id || m.author.id === p2.id) && m.content === targetSentence;

        // İlk doğru yazanı al
        const winnerCollector = channel.createMessageCollector({ filter, time: 30000, max: 1 });

        winnerCollector.on('collect', async m => {
            const winner = m.author;
            const loser = m.author.id === p1.id ? p2 : p1;
            const winAmount = amount * 2;

            // Ödül
            await User.findOneAndUpdate({ odasi: winner.id, odaId: guildId }, { $inc: { balance: winAmount } });

            const winEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🎉 KAZANAN BELLİ OLDU!')
                .setDescription(`👑 **<@${winner.id}>** parmaklarını konuşturdu!\n\n📝 **Hatasız Yazıldı:** *"${targetSentence}"*\n💰 **Kazanılan:** ${winAmount} NexCoin`);

            await message.edit({ content: `🏆 Kazanan: <@${winner.id}>`, embeds: [winEmbed] });

            // Quest
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress({ odasi: winner.id, odaId: guildId }, 'gamble', 1);
            } catch (e) { }
        });

        winnerCollector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                // Berabere (İade)
                await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: amount } });
                await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: amount } });

                await message.edit({ content: '⏰ **SÜRE DOLDU!** Kimse yazamadı. Paralar iade edildi.', embeds: [] });
            }
        });

    }, 4000);
}
