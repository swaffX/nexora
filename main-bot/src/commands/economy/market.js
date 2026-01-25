const path = require('path');
const { SlashCommandBuilder, EmbedBuilder , MessageFlags } = require('discord.js');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS, ItemType } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Oyun içi eşyaları satın alın')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Marketteki eşyaları listele'))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Eşya satın al')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Satın alınacak eşya ID veya ismi')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('miktar')
                        .setDescription('Kaç adet?')
                        .setMinValue(1)
                        .setMaxValue(100))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userData = await User.findOrCreate(interaction.user.id, interaction.guild.id, interaction.user.username);
        const { getDailyDeal, decreaseStock } = require('../../utils/dailyDealManager');
        const dailyDeal = getDailyDeal();

        if (subcommand === 'list') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 Nexora Market')
                .setDescription(`Bakiyeniz: **${userData.balance.toLocaleString()} NexCoin**\n\nSatın almak için: \`/market buy [eşya]\``)
                .setColor(0xF1C40F)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/1170/1170679.png');

            // 🔥 GÜNÜN FIRSATI
            if (dailyDeal && dailyDeal.stock > 0) {
                embed.addFields({
                    name: `🔥 GÜNÜN FIRSATI (-%${dailyDeal.discountPercent})`,
                    value: `${dailyDeal.emoji} **${dailyDeal.name}**\nFiyat: ~~${dailyDeal.originalPrice.toLocaleString()}~~ ➡️ **${dailyDeal.salePrice.toLocaleString()} NexCoin**\n📦 Stok: **${dailyDeal.stock}** adet kaldı!\nID: \`${dailyDeal.itemId}\``
                });
            } else if (dailyDeal && dailyDeal.stock <= 0) {
                embed.addFields({
                    name: `🔥 GÜNÜN FIRSATI (TÜKENDİ)`,
                    value: `Bugünün fırsatı **${dailyDeal.name}** tamamen satıldı! Yarını bekle.`
                });
            }

            // Kategorilere ayır
            const categories = {
                [ItemType.BOX]: [],
                [ItemType.PET]: [],
                [ItemType.COLLECTIBLE]: []
            };

            for (const item of Object.values(ITEMS)) {
                if (item.price > 0 && categories[item.type]) {
                    categories[item.type].push(item);
                }
            }

            // Kutular
            if (categories[ItemType.BOX].length > 0) {
                const text = categories[ItemType.BOX].map(i =>
                    `${i.emoji} **${i.name}** (\`${i.id}\`) - 💰 ${i.price.toLocaleString()}`
                ).join('\n');
                embed.addFields({ name: '📦 Kutular', value: text });
            }

            // Petler
            if (categories[ItemType.PET].length > 0) {
                const text = categories[ItemType.PET].map(i =>
                    `${i.emoji} **${i.name}** (\`${i.id}\`) - 💰 ${i.price.toLocaleString()}`
                ).join('\n');
                embed.addFields({ name: '🐾 Siber Yoldaşlar', value: text });
            }

            // Diğer
            if (categories[ItemType.COLLECTIBLE].length > 0) {
                const text = categories[ItemType.COLLECTIBLE].map(i =>
                    `${i.emoji} **${i.name}** (\`${i.id}\`) - 💰 ${i.price.toLocaleString()}`
                ).join('\n');
                embed.addFields({ name: '💎 Eşyalar', value: text });
            }

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'buy') {
            const query = interaction.options.getString('item').toLowerCase();
            const amount = interaction.options.getInteger('miktar') || 1;

            // Eşyayı bul
            const item = Object.values(ITEMS).find(i =>
                i.id === query || i.name.toLowerCase().includes(query)
            );

            if (!item) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Böyle bir eşya bulunamadı.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (item.price <= 0) return interaction.reply({ embeds: [embeds.error('Hata', 'Bu eşya satılık değil.')], flags: MessageFlags.Ephemeral });

            // Fiyat Hesaplama (İndirim Kontrolü)
            let unitPrice = item.price;
            let isDealItem = false;

            if (dailyDeal && dailyDeal.itemId === item.id) {
                if (dailyDeal.stock >= amount) {
                    unitPrice = dailyDeal.salePrice;
                    isDealItem = true;
                } else if (dailyDeal.stock > 0) {
                    return interaction.reply({
                        content: `🔥 Fırsat ürününden sadece **${dailyDeal.stock}** adet kaldı! Lütfen daha az miktar girin.`,
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    // Stok bitti, normal fiyattan alacak mı? (İsteğe bağlı, şimdilik normal fiyata dönelim)
                    // return interaction.reply('Fırsat ürünü tükendi! Normal fiyattan almak için ...'); 
                }
            }

            const totalPrice = unitPrice * amount;

            if (userData.balance < totalPrice) {
                return interaction.reply({
                    embeds: [embeds.error('Yetersiz Bakiye', `Eksik: **${(totalPrice - userData.balance).toLocaleString()} NexCoin**`)],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Satın alma işlemi
            userData.balance -= totalPrice;

            // Envantere ekle
            const inventoryItem = userData.inventory.find(i => i.itemId === item.id);
            if (inventoryItem) {
                inventoryItem.amount += amount;
            } else {
                userData.inventory.push({ itemId: item.id, amount: amount });
            }

            // Stok düş
            if (isDealItem) {
                decreaseStock(amount);
            }

            await userData.save();

            // Quest Update
            try {
                const { updateQuestProgress } = require('../../utils/questManager');
                await updateQuestProgress(userData, 'buy', amount);
            } catch (e) { }

            return interaction.reply({
                embeds: [embeds.success('Satın Alma Başarılı',
                    `${amount} adet ${item.emoji} **${item.name}** satın aldınız.\n` +
                    (isDealItem ? `🔥 **Günün Fırsatı İndirimi Uygulandı!**\n` : '') +
                    `Ödenen: **${totalPrice.toLocaleString()} NexCoin**\n` +
                    `Kalan: **${userData.balance.toLocaleString()} NexCoin**`
                )]
            });
        }
    }
};
