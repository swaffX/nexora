const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

        if (subcommand === 'list') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 Nexora Market')
                .setDescription(`Bakiyeniz: **${userData.balance.toLocaleString()} NexCoin**\n\nSatın almak için: \`/market buy [eşya]\``)
                .setColor(0xF1C40F)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/1170/1170679.png');

            // Kategorilere ayır
            const categories = {
                [ItemType.BOX]: [],
                [ItemType.PET]: [],
                [ItemType.COLLECTIBLE]: [] // Sadece "price > 0" olanlar
            };

            for (const item of Object.values(ITEMS)) {
                if (item.price > 0 && categories[item.type]) {
                    categories[item.type].push(item);
                }
            }

            // Kutular
            if (categories[ItemType.BOX].length > 0) {
                const text = categories[ItemType.BOX].map(i =>
                    `${i.emoji} **${i.name}** - 💰 ${i.price.toLocaleString()}`
                ).join('\n');
                embed.addFields({ name: '📦 Kutular', value: text });
            }

            // Petler
            if (categories[ItemType.PET].length > 0) {
                const text = categories[ItemType.PET].map(i =>
                    `${i.emoji} **${i.name}** - 💰 ${i.price.toLocaleString()}\n└ *${i.bonus.type === 'xp' ? 'XP Bonusu' : i.bonus.type === 'money' ? 'Para Bonusu' : i.bonus.type === 'luck' ? 'Şans Bonusu' : 'Saldırı Gücü'}*`
                ).join('\n');
                embed.addFields({ name: '🐾 Siber Yoldaşlar', value: text });
            }

            // Diğer
            if (categories[ItemType.COLLECTIBLE].length > 0) {
                const text = categories[ItemType.COLLECTIBLE].map(i =>
                    `${i.emoji} **${i.name}** - 💰 ${i.price.toLocaleString()}`
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
                    ephemeral: true
                });
            }

            if (item.price <= 0) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Bu eşya markette satılmıyor.')],
                    ephemeral: true
                });
            }

            const totalPrice = item.price * amount;

            if (userData.balance < totalPrice) {
                return interaction.reply({
                    embeds: [embeds.error('Yetersiz Bakiye', `Eksik: **${(totalPrice - userData.balance).toLocaleString()} NexCoin**`)],
                    ephemeral: true
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

            await userData.save();

            return interaction.reply({
                embeds: [embeds.success('Satın Alma Başarılı',
                    `${amount} adet ${item.emoji} **${item.name}** satın aldınız.\n` +
                    `Ödenen: **${totalPrice.toLocaleString()} NexCoin**\n` +
                    `Kalan: **${userData.balance.toLocaleString()} NexCoin**`
                )]
            });
        }
    }
};
