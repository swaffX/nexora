const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS, ItemType } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pets')
        .setDescription('Siber Yoldaşlarını yönet'),

    async execute(interaction) {
        const user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });

        if (!user || !user.inventory) return interaction.reply({ content: '❌ Hiçbir eşyan (veya petin) yok.', ephemeral: true });

        // Envanterden PET olanları filtrele
        const myPets = user.inventory.filter(slot => {
            const item = ITEMS[slot.itemId];
            return item && item.type === ItemType.PET;
        });

        if (myPets.length === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setTitle('😢 Yalnızsın...').setDescription('Hiç Siber Yoldaşın yok.\n`/hunt` yaparak veya Kutu açarak (/use) bulabilirsin!')]
            });
        }

        // Aktif Pet Bilgisi
        const activePetData = user.activePet ? ITEMS[user.activePet] : null;

        let description = activePetData
            ? `🟢 **Şu anki Yoldaşın:** ${activePetData.emoji} **${activePetData.name}**\n*Bonus:* `
            : '🔴 **Aktif Yoldaşın Yok.** Bir tane seçerek bonus kazan!\n\n';

        if (activePetData) {
            if (activePetData.bonus.type === 'money') description += `💰 +%${activePetData.bonus.amount} Çalışma Parası\n\n`;
            if (activePetData.bonus.type === 'xp') description += `✨ +%${activePetData.bonus.amount} XP Kazanımı\n\n`;
            if (activePetData.bonus.type === 'luck') description += `🍀 +%${activePetData.bonus.amount} Şans\n\n`;
            if (activePetData.bonus.type === 'attack') description += `⚔️ +${activePetData.bonus.amount} Saldırı Gücü\n\n`;
        }

        description += '**📂 Yoldaşların:**\n';
        const options = [];

        myPets.forEach((slot, index) => {
            const item = ITEMS[slot.itemId];
            description += `${index + 1}. ${item.emoji} **${item.name}** (x${slot.amount})\n`;

            options.push(new StringSelectMenuOptionBuilder()
                .setLabel(item.name)
                .setValue(item.id)
                .setEmoji(item.emoji)
                .setDescription(`Bonus: ${item.bonus.type.toUpperCase()} +${item.bonus.amount}`));
        });

        const select = new StringSelectMenuBuilder()
            .setCustomId('pet_select')
            .setPlaceholder('Yoldaşını Seç')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🤖 Siber Yoldaş Yönetimi')
            .setDescription(description)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/4712/4712035.png'); // Robot pet icon

        await interaction.reply({ embeds: [embed], components: [row] });

        // Collector (Dinleyici)
        const filter = i => i.customId === 'pet_select' && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const selectedId = i.values[0];
            const item = ITEMS[selectedId];

            user.activePet = selectedId;
            await user.save();

            await i.reply({ content: `✅ **${item.name}** seninle yolculuğa çıktı! Bonusların aktif.`, ephemeral: true });
        });
    },

    // Not: Bu collector tek kullanımlık (slash command scope). Persistent component handler (interactionCreate) içinde yapmak daha iyi olurdu ama şimdilik hızlı çözüm.
};
