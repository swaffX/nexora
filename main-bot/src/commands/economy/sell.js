const { SlashCommandBuilder, EmbedBuilder , MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Eşyaları satıp paraya çevir')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Satılacak eşya (veya "all" ile her şey)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Kaç tane satılacak? (Boş bırakırsan 1)')),

    async execute(interaction) {
        const itemQuery = interaction.options.getString('item').toLowerCase();
        let amount = interaction.options.getInteger('amount') || 1;

        let user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user || !user.inventory || user.inventory.length === 0) {
            return interaction.reply({ content: '❌ Satacak hiç eşyan yok!', flags: MessageFlags.Ephemeral });
        }

        // HEPSİNİ SAT MODU
        if (itemQuery === 'all' || itemQuery === 'hepsi') {
            let totalEarnings = 0;
            let soldCount = 0;

            // Filtrele: Sadece satılabilir (price > 0) olanları sat
            // Kutular genelde satılmaz ama sellPrice tanımlıysa satılır.

            // inventory'i kopyala çünkü loop içinde değiştireceğiz
            const originalInv = [...user.inventory];
            let newInv = [];

            for (const slot of originalInv) {
                const itemData = ITEMS[slot.itemId];
                if (itemData && itemData.sellPrice > 0) {
                    totalEarnings += itemData.sellPrice * slot.amount;
                    soldCount += slot.amount;
                    // Envantere ekleme (satıldı)
                } else {
                    // Satılmaz, geri koy
                    newInv.push(slot);
                }
            }

            if (soldCount === 0) return interaction.reply({ content: '❌ Satılabilecek değerli bir eşyan yok.', flags: MessageFlags.Ephemeral });

            user.inventory = newInv;
            user.balance += totalEarnings;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('🤑 Pazarlık Başarılı')
                .setDescription(`Çantandaki **${soldCount}** eşyanın hepsini hurdacıya sattın.`)
                .addFields({ name: 'Kazanılan', value: `+${totalEarnings.toLocaleString()} NexCoin` });

            return interaction.reply({ embeds: [embed] });
        }

        // TEK EŞYA SAT MODU
        // Eşyaları Rarity'ye göre sırala (Inventory ile aynı sıra olmalı)
        if (!user.inventory) user.inventory = [];
        const sortedInv = user.inventory.sort((a, b) => {
            const itemA = ITEMS[a.itemId];
            const itemB = ITEMS[b.itemId];
            const rarityOrder = { 'Mistik': 6, 'Efsanevi': 5, 'Destansı': 4, 'Eşsiz': 3, 'Nadir': 2, 'Yaygın': 1 };
            return rarityOrder[itemB.rarity.name] - rarityOrder[itemA.rarity.name];
        });

        let slot = null;

        // Girdi bir sayı mı?
        if (!isNaN(itemQuery)) {
            const index = parseInt(itemQuery) - 1;
            if (index >= 0 && index < sortedInv.length) {
                slot = sortedInv[index];
            }
        } else {
            slot = sortedInv.find(s => s.itemId === itemQuery || ITEMS[s.itemId].name.toLowerCase() === itemQuery);
        }

        if (!slot) return interaction.reply({ content: '❌ Böyle bir eşyan yok. Sıra numarasını kontrol et.', flags: MessageFlags.Ephemeral });

        if (slot.amount < amount) return interaction.reply({ content: `❌ Elinde sadece **${slot.amount}** tane var.`, flags: MessageFlags.Ephemeral });

        const itemData = ITEMS[slot.itemId];
        if (itemData.sellPrice <= 0) return interaction.reply({ content: '🚫 Bu eşya satılamaz!', flags: MessageFlags.Ephemeral });

        const earnings = itemData.sellPrice * amount;

        // Eşyayı düş
        slot.amount -= amount;
        if (slot.amount <= 0) {
            user.inventory = user.inventory.filter(s => s.itemId !== slot.itemId);
        }

        user.balance += earnings;
        await user.save();

        return interaction.reply({
            content: `🤝 **${amount}** adet ${itemData.emoji} **${itemData.name}** sattın ve **${earnings} NexCoin** kazandın!`
        });
    }
};
