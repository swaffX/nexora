const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Nexora Casino & Oyun Menüsü'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#2C2F33')
            .setTitle('🎰 NEXORA CASINO 🎰')
            .setDescription(`
Hoş geldin! Aşağıdaki menüden oynamak istediğin oyunu seçerek bilgi alabilirsin.
Tüm oyunlarda **\`min 10-100\`** arasında değişen bahis limitleri vardır.
Paranın tamamını basmak için **\`all\`** yazabilirsin.

**🎲 Mevcut Oyunlar:**
            `)
            .addFields(
                { name: '🔥 Popüler', value: 'Crash, Mines, Blackjack', inline: true },
                { name: '💰 Klasik', value: 'Rulet, Slot, Yazı Tura', inline: true },
                { name: '⚔️ Aksiyon', value: 'Rus Ruleti, Düello, At Yarışı', inline: true }
            )
            .setImage('https://thumbs.dreamstime.com/b/casino-banner-roulette-chips-vector-illustration-48861962.jpg') // Örnek banner
            .setFooter({ text: 'Şans seninle olsun! | /daily ile günlük paranı almayı unutma.' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('casino_menu')
            .setPlaceholder('Bir oyun seç...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Crash (Aviator)').setValue('crash').setEmoji('🚀').setDescription('Çarpan yükselirken kaç!'),
                new StringSelectMenuOptionBuilder().setLabel('Mines (Mayın)').setValue('mines').setEmoji('💣').setDescription('Elmasları bul, bombadan kaç.'),
                new StringSelectMenuOptionBuilder().setLabel('Blackjack (21)').setValue('blackjack').setEmoji('🃏').setDescription('Krupiyeyi yen, 21 yap.'),
                new StringSelectMenuOptionBuilder().setLabel('Rus Ruleti').setValue('rr').setEmoji('🔫').setDescription('Ya hep ya hiç!'),
                new StringSelectMenuOptionBuilder().setLabel('At Yarışı').setValue('race').setEmoji('🐎').setDescription('Favori atına bahis yap.'),
                new StringSelectMenuOptionBuilder().setLabel('Slot Makinesi').setValue('slots').setEmoji('🎰').setDescription('Çarkları çevir, 777 yakala.'),
                new StringSelectMenuOptionBuilder().setLabel('Rulet').setValue('roulette').setEmoji('🎱').setDescription('Renk veya sayıya oyna.'),
                new StringSelectMenuOptionBuilder().setLabel('Yazı Tura').setValue('coinflip').setEmoji('🪙').setDescription('Basit ve hızlı.'),
                new StringSelectMenuOptionBuilder().setLabel('Düello').setValue('duel').setEmoji('⚔️').setDescription('Arkadaşına meydan oku.')
            );

        const row = new ActionRowBuilder().addComponents(select);

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Collector
        const filter = i => i.customId === 'casino_menu' && i.user.id === interaction.user.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const val = i.values[0];
            let guideText = '';
            let cmdText = '';

            switch (val) {
                case 'crash':
                    guideText = '**🚀 CRASH (Aviator)**\nGrafik yükselirken (1.0x -> 10.0x...) istediğin anda "Nakit Çek" butonuna basmalısın. Eğer sen çekmeden grafik PATLARSA (Crash) paran gider!';
                    cmdText = 'Komut: `/crash <miktar>`';
                    break;
                case 'mines':
                    guideText = '**💣 MINES (Mayın Tarlası)**\n25 kutulu alanda elmasları bulmaya çalış. Her elmas kazancını katlar. İstediğin zaman parayı alıp çıkabilirsin ama bombaya basarsan HEPSİ GİDER!';
                    cmdText = 'Komut: `/mines <miktar> <bomba_sayısı>`';
                    break;
                case 'blackjack':
                    guideText = '**🃏 BLACKJACK (21)**\nKrupiyeye karşı kart çek. Toplam 21\'e en yakın olan kazanır. 21\'i geçersen (Bust) kaybedersin. \nJ, Q, K = 10, A = 1 veya 11.';
                    cmdText = 'Komut: `/blackjack <miktar>`';
                    break;
                case 'rr':
                    guideText = '**🔫 RUS RULETİ**\nSilahı şakağına daya ve tetiği çek. %16 ihtimalle patlar. Patlamazsa bahsinin 1.5 katını alırsın. Cesaretin var mı?';
                    cmdText = 'Komut: `/rus-ruleti <miktar>`';
                    break;
                case 'race':
                    guideText = '**🐎 AT YARIŞI**\nFavori atını seç ve izle. Atın birinci gelirse bahsinin 3 katını alırsın.';
                    cmdText = 'Komut: `/horserace <miktar> <at_no>`';
                    break;
                case 'slots':
                    guideText = '**🎰 SLOT MAKİNESİ**\nKolu çevir, aynı sembolleri yan yana getir. 7️⃣-7️⃣-7️⃣ yaparsan JACKPOT!';
                    cmdText = 'Komut: `/slots <miktar>`';
                    break;
                case 'roulette':
                    guideText = '**🎱 RULET**\nKırmızı, Siyah, Yeşil veya direkt bir sayıya oyna. Sayı tutarsa 36 katını alırsın!';
                    cmdText = 'Komut: `/roulette [renk/sayı] [miktar]`';
                    break;
                case 'coinflip':
                    guideText = '**🪙 YAZI TURA**\nEn klasik bahis. Şansın %50.';
                    cmdText = 'Komut: `/coinflip <miktar> [yazı/tura]`';
                    break;
                case 'duel':
                    guideText = '**⚔️ DÜELLO**\nBir arkadaşını etiketle ve ortaya para koyun. Kazanan hepsini alır! (Petlerin gücü etkiler)';
                    cmdText = 'Komut: `/duel @kullanıcı <miktar>`';
                    break;
            }

            const guideEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`Nasıl Oynanır: ${val.toUpperCase()}`)
                .setDescription(`${guideText}\n\n👉 **${cmdText}**`)
                .setFooter({ text: 'Menüden başka oyun seçebilirsin.' });

            await i.reply({ embeds: [guideEmbed], flags: MessageFlags.Ephemeral });
        });
    }
};
