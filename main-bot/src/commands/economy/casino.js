const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Nexora Casino & Oyun Menüsü'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#2C2F33')
            .setTitle('🎰 NEXORA CASINO 🎰')
            .setDescription(`
Hoş geldin! Aşağıdaki menüden oynamak istediğin oyunu seçerek **direkt oynayabilirsin!**
Açılan pencereye bahis miktarını girmen yeterli.

**🎲 Oyunlar:**
            `)
            .addFields(
                { name: '🔥 Popüler', value: 'Crash, Mines, Blackjack', inline: true },
                { name: '💰 Klasik', value: 'Rulet, Slot, Yazı Tura', inline: true },
                { name: '⚔️ Aksiyon', value: 'Rus Ruleti, At Yarışı', inline: true }
            )
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=69795812&is=69780692&hm=38d32a4728d978f24f28e48049aa6d6a8b9be3d9daf7e8caae19b02b40ed691c&')
            .setFooter({ text: 'Şans seninle olsun! | /daily ile günlük paranı al.' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('casino_menu')
            .setPlaceholder('Bir oyun seç ve OYNA!')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Crash (Aviator)').setValue('crash').setEmoji('🚀').setDescription('Çarpan yükselirken kaç!'),
                new StringSelectMenuOptionBuilder().setLabel('Mines (Mayın)').setValue('mines').setEmoji('💣').setDescription('Elmasları bul, bombadan kaç.'),
                new StringSelectMenuOptionBuilder().setLabel('Blackjack (21)').setValue('blackjack').setEmoji('🃏').setDescription('Krupiyeyi yen, 21 yap.'),
                new StringSelectMenuOptionBuilder().setLabel('Rus Ruleti').setValue('russian-roulette').setEmoji('🔫').setDescription('Ya hep ya hiç!'), // Komut adı: russian-roulette
                new StringSelectMenuOptionBuilder().setLabel('At Yarışı').setValue('horserace').setEmoji('🐎').setDescription('Favori atına bahis yap.'),
                new StringSelectMenuOptionBuilder().setLabel('Slot Makinesi').setValue('slots').setEmoji('🎰').setDescription('Çarkları çevir, 777 yakala.'),
                new StringSelectMenuOptionBuilder().setLabel('Rulet').setValue('roulette').setEmoji('🎱').setDescription('Renk veya sayıya oyna.'),
                new StringSelectMenuOptionBuilder().setLabel('Yazı Tura').setValue('coinflip').setEmoji('🪙').setDescription('Basit ve hızlı.')
            );

        const row = new ActionRowBuilder().addComponents(select);

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Collector
        const filter = i => i.customId === 'casino_menu' && i.user.id === interaction.user.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const val = i.values[0];

            // MODAL TANIMLARI
            const modalData = {
                'crash': { title: '🚀 Crash Başlat', inputs: [{ id: 'bahis', label: 'Bahis (veya all)', style: TextInputStyle.Short }] },
                'mines': { title: '💣 Mines Başlat', inputs: [{ id: 'bahis', label: 'Bahis', style: TextInputStyle.Short }, { id: 'bombalar', label: 'Bomba Sayısı (1-15)', style: TextInputStyle.Short }] },
                'blackjack': { title: '🃏 Blackjack Başlat', inputs: [{ id: 'bahis', label: 'Bahis (veya all)', style: TextInputStyle.Short }] },
                'russian-roulette': { title: '🔫 Rus Ruleti', inputs: [{ id: 'bahis', label: 'Bahis (veya all)', style: TextInputStyle.Short }] },
                'horserace': { title: '🐎 At Yarışı', inputs: [{ id: 'bahis', label: 'Bahis', style: TextInputStyle.Short }, { id: 'at', label: 'At Numarası (1-5)', style: TextInputStyle.Short }] },
                'slots': { title: '🎰 Slot Çevir', inputs: [{ id: 'bahis', label: 'Bahis (veya all)', style: TextInputStyle.Short }] },
                'roulette': { title: '🎱 Rulet Oyna', inputs: [{ id: 'amount', label: 'Bahis', style: TextInputStyle.Short }, { id: 'choice', label: 'Seçim (kırmızı, siyah, sayı)', style: TextInputStyle.Short }] }, // Roulette command uses 'amount' & 'choice'
                'coinflip': { title: '🪙 Yazı Tura', inputs: [{ id: 'miktar', label: 'Bahis', style: TextInputStyle.Short }, { id: 'secim', label: 'yazi / tura', style: TextInputStyle.Short }] } // Coinflip uses 'miktar' & 'secim'
            }[val];

            if (modalData) {
                const mb = new ModalBuilder()
                    .setCustomId(`casino_modal_${val}`) // Önemli: Global handler bunu parse edecek
                    .setTitle(modalData.title);

                modalData.inputs.forEach(inp => {
                    mb.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(inp.id) // Parametre ismi (komuttaki option name ile AYNI olmalı)
                            .setLabel(inp.label)
                            .setStyle(inp.style)
                            .setRequired(true)
                    ));
                });

                await i.showModal(mb);
            }
        });
    }
};
