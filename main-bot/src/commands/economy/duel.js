const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Bir kullanıcıyı bahisli düelloya davet et')
        .addUserOption(opt => opt.setName('rakip').setDescription('Kime meydan okuyorsun?').setRequired(true))
        .addIntegerOption(opt => opt.setName('bahis').setDescription('Ortaya konacak para miktarı').setRequired(true).setMinValue(100)),

    async execute(interaction) {
        const opponent = interaction.options.getUser('rakip');
        const betAmount = interaction.options.getInteger('bahis');
        const challenger = interaction.user;

        if (opponent.id === challenger.id) return interaction.reply({ content: 'Kendinle savaşamazsın, deli olma!', ephemeral: true });
        if (opponent.bot) return interaction.reply({ content: 'Botlarla savaşamazsın.', ephemeral: true });

        // DATABASE CHECK
        const p1 = await User.findOne({ odasi: challenger.id, odaId: interaction.guild.id });
        const p2 = await User.findOne({ odasi: opponent.id, odaId: interaction.guild.id });

        if (!p1 || p1.balance < betAmount) return interaction.reply({ content: '❌ Senin paran yetersiz!', ephemeral: true });
        if (!p2 || p2.balance < betAmount) return interaction.reply({ content: `❌ **${opponent.username}** kullanıcısının parası yetersiz.`, ephemeral: true });

        // TEKLİF EMBED
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('⚔️ DÜELLO ÇAĞRISI')
            .setDescription(`<@${challenger.id}>, <@${opponent.id}> kişisine meydan okudu!\n\n💰 **Bahis:** ${betAmount} NexCoin\n\nKabul ediyor musun?`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3094/3094924.png'); // Swords icon

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('duel_accept').setLabel('Kabul Et (Savaş!)').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('duel_deny').setLabel('Reddet (Korkak)').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row], fetchReply: true });

        const filter = i => i.customId.startsWith('duel') && i.user.id === opponent.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'duel_deny') {
                await i.update({ content: 'Düello reddedildi.', components: [] });
                return;
            }

            // ACCEPT
            // Paraları Kilitle (Double check balance again just in case)
            if (p1.balance < betAmount || p2.balance < betAmount) {
                return i.reply({ content: 'Bakiye hatası oluştu, savaş iptal.', ephemeral: true });
            }

            p1.balance -= betAmount;
            p2.balance -= betAmount;

            // Savaş Logiği (Pet Bonusu Dahil)
            let p1Score = Math.floor(Math.random() * 100); // 0-100 Güç
            let p2Score = Math.floor(Math.random() * 100);

            // Pet Bonusları
            let p1Bonus = 0;
            let p2Bonus = 0;

            if (p1.activePet && ITEMS[p1.activePet].bonus.type === 'attack') p1Bonus = ITEMS[p1.activePet].bonus.amount;
            if (p2.activePet && ITEMS[p2.activePet].bonus.type === 'attack') p2Bonus = ITEMS[p2.activePet].bonus.amount;

            p1Score += p1Bonus;
            p2Score += p2Bonus;

            // Animasyonlu Savaş
            await i.update({ content: '**⚔️ Savaş Başladı! ⚔️**\n\n*Kılıçlar çekildi, petler saldırıyor...*', components: [] });

            setTimeout(async () => {
                let resultText = '';
                let winner = null;
                const totalPot = betAmount * 2;

                if (p1Score > p2Score) {
                    winner = p1;
                    p1.balance += totalPot;
                    resultText = `👑 **KAZANAN:** <@${challenger.id}> (Güç: ${p1Score})\n💀 **Kaybeden:** <@${opponent.id}> (Güç: ${p2Score})\n\n💰 **Kazanılan:** ${totalPot} NexCoin`;
                } else {
                    winner = p2;
                    p2.balance += totalPot;
                    resultText = `👑 **KAZANAN:** <@${opponent.id}> (Güç: ${p2Score})\n💀 **Kaybeden:** <@${challenger.id}> (Güç: ${p1Score})\n\n💰 **Kazanılan:** ${totalPot} NexCoin`;
                }

                await p1.save();
                await p2.save();

                const resultEmbed = new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle('🏆 Savaş Sonucu')
                    .setDescription(resultText)
                    .setFooter({ text: p1Bonus || p2Bonus ? 'Siber Yoldaşlar savaşın kaderini değiştirdi!' : 'Saf güç savaşıydı.' });

                await interaction.followUp({ embeds: [resultEmbed] });

            }, 3000);
        });
    }
};
