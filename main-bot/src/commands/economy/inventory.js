const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS, Rarity } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Çantana ve eşyalarına bak.'),

    async execute(interaction) {
        const user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });

        if (!user || !user.inventory || user.inventory.length === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription('🎒 **Çantan bomboş!**\n`/work` yaparak veya `/daily` ödüllerinden eşya kazanabilirsin.')]
            });
        }

        // Envanteri Düzenle
        let description = '';
        let totalValue = 0;

        // Eşyaları Rarity'ye göre sırala (Mistik en üstte)
        const sortedInv = user.inventory.sort((a, b) => {
            const itemA = ITEMS[a.itemId];
            const itemB = ITEMS[b.itemId];
            // Basit bir rarity puanlaması. Sıra: Mythic > Legendary > Epic > Rare > Uncommon > Common
            const rarityOrder = { 'Mistik': 6, 'Efsanevi': 5, 'Destansı': 4, 'Eşsiz': 3, 'Nadir': 2, 'Yaygın': 1 };
            return rarityOrder[itemB.rarity.name] - rarityOrder[itemA.rarity.name];
        });

        let index = 1;
        for (const slot of sortedInv) {
            const item = ITEMS[slot.itemId];
            if (!item) continue;

            totalValue += item.sellPrice * slot.amount;
            description += `**[${index}]** ${item.emoji} **${item.name}** x${slot.amount}\n└ *${item.rarity.name}* — Değer: ${item.sellPrice} kaynak\n\n`;
            index++;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: `${interaction.user.username} - Çantası`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`💰 **Toplam Çanta Değeri:** ${totalValue.toLocaleString()} NexCoin\n\n${description}`)
            .setFooter({ text: 'Kullanmak için: /use [sıra_no], Satmak için: /sell [sıra_no]' });

        await interaction.reply({ embeds: [embed] });
    }
};
