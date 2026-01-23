const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS, ItemType } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Bir eşyayı veya kutuyu kullan')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Kullanılacak eşyanın IDsi veya ismi')
                .setRequired(true)
                .setAutocomplete(true)), // Autocomplete handler gerekebilir ama şimdilik düz string

    async execute(interaction) {
        const itemQuery = interaction.options.getString('item').toLowerCase();

        let user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user || user.inventory.length === 0) return interaction.reply({ content: '🎒 Çantan boş!', ephemeral: true });

        // Eşyaları Rarity'ye göre sırala (Inventory ile aynı sıra olması ŞART)
        const sortedInv = user.inventory.sort((a, b) => {
            const itemA = ITEMS[a.itemId];
            const itemB = ITEMS[b.itemId];
            const rarityOrder = { 'Mistik': 6, 'Efsanevi': 5, 'Destansı': 4, 'Eşsiz': 3, 'Nadir': 2, 'Yaygın': 1 };
            return rarityOrder[itemB.rarity.name] - rarityOrder[itemA.rarity.name];
        });

        let slot = null;

        // Girdi bir sayı mı? Sanıyorsan convert et.
        if (!isNaN(itemQuery)) {
            const index = parseInt(itemQuery) - 1;
            if (index >= 0 && index < sortedInv.length) {
                slot = sortedInv[index];
            }
        } else {
            // İsimle arama
            slot = sortedInv.find(s => s.itemId === itemQuery || ITEMS[s.itemId].name.toLowerCase() === itemQuery);
        }

        if (!slot) {
            return interaction.reply({ content: '❌ Bu eşya bulunamadı! `/inventory` yazıp sıra numarasına bak.', ephemeral: true });
        }

        const item = ITEMS[slot.itemId];

        // Sadece KUTULAR kullanılabilir (şimdilik)
        if (item.type !== ItemType.BOX) {
            return interaction.reply({ content: `🚫 **${item.name}** kullanılamaz, sadece satılabilir (/sell).`, ephemeral: true });
        }

        // Eşyayı eksilt
        slot.amount -= 1;
        if (slot.amount <= 0) {
            user.inventory = user.inventory.filter(s => s.itemId !== slot.itemId);
        }

        // 1. AÇILIŞ ANİMASYONU
        const openingEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🔓 ${item.name} Açılıyor...`)
            .setDescription(`${item.emoji} Kilitler kırılıyor...`)
            .setImage('https://media1.tenor.com/m/y5a_A5d0BHgAAAAC/treasure-chest-loot.gif'); // Generic chest gif

        await interaction.reply({ embeds: [openingEmbed] });

        // DROP HESAPLAMA
        const drops = item.drops;
        const wonCoins = Math.floor(Math.random() * (drops.maxCoins - drops.minCoins + 1)) + drops.minCoins;

        // Eşya Drop Logic (Weighted Random)
        let wonItem = null;
        const totalWeight = drops.items.reduce((sum, i) => sum + i.weight, 0);
        let random = Math.random() * totalWeight;

        for (const drop of drops.items) {
            if (random < drop.weight) {
                wonItem = ITEMS[drop.id];
                break;
            }
            random -= drop.weight;
        }

        // Ödülleri Ver
        user.balance += wonCoins;

        if (wonItem) {
            const existingSlot = user.inventory.find(s => s.itemId === wonItem.id);
            if (existingSlot) existingSlot.amount += 1;
            else user.inventory.push({ itemId: wonItem.id, amount: 1 });
        }

        await user.save();

        // 2 Saniye Bekle ve Sonucu Göster
        setTimeout(async () => {
            const resultEmbed = new EmbedBuilder()
                .setColor(wonItem ? wonItem.rarity.color : '#bdc3c7')
                .setTitle(`🎉 ${item.name} Açıldı!`)
                .setDescription(`Kutunun içinden şunlar çıktı:`)
                .addFields(
                    { name: '💰 Para', value: `+${wonCoins} NexCoin`, inline: true },
                    { name: '🎁 Eşya', value: wonItem ? `${wonItem.emoji} **${wonItem.name}**\n*${wonItem.rarity.name}*` : '💨 *Toz bulutu* (Eşya çıkmadı)', inline: true }
                )
                .setThumbnail(wonItem ? 'https://icon-library.com/images/sparkles-icon-png/sparkles-icon-png-15.jpg' : null);

            await interaction.editReply({ embeds: [resultEmbed] });
        }, 2500);
    }
};
