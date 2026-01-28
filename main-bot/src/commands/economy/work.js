const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

const JOBS = [
    { name: 'Yazılımcı', text: 'kod yazarak', min: 100, max: 500, emoji: '💻' },
    { name: 'Discord Modu', text: 'sunucuyu moder ederek', min: 50, max: 200, emoji: '🛡️' },
    { name: 'Yayıncı', text: 'yayın açarak', min: 200, max: 800, emoji: '🎥' },
    { name: 'Tasarımcı', text: 'logo tasarlayarak', min: 150, max: 600, emoji: '🎨' },
    { name: 'Madenci', text: 'kripto kazarak', min: 300, max: 1000, emoji: '⛏️' },
    { name: 'Barmen', text: 'içki servis ederek', min: 80, max: 300, emoji: '🍺' },
    { name: 'Hacker', text: 'bir bankayı soyarak', min: 1000, max: 3000, chance: 0.05 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Çalış ve para kazan!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        let user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user) user = new User({ odasi: userId, odaId: guildId });

        // Cooldown Check (5 Dakika)
        const now = Date.now();
        const cooldownTime = 5 * 60 * 1000;

        if (user.lastWork && now - user.lastWork < cooldownTime) {
            const remaining = cooldownTime - (now - user.lastWork);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return interaction.reply({
                content: `⏳ **Çok yorgunsun!** Tekrar çalışmak için **${minutes}dk ${seconds}sn** beklemelisin.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Job Logic
        let availableJobs = [...JOBS];

        // Hacker işi sadece %5 şansla havuzda kalsın, aksi takdirde çıkar
        if (Math.random() > 0.05) {
            availableJobs = JOBS.filter(j => j.name !== 'Hacker');
        }

        const job = availableJobs[Math.floor(Math.random() * availableJobs.length)];

        const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
        user.balance += earnings;
        user.lastWork = now;

        // --- DROP SISTEMI V2 ---
        let droppedItem = null;
        const roll = Math.random() * 1000; // 0 - 1000

        // Tiered Drop Chances
        if (roll > 998) droppedItem = 'crypto_box';        // %0.2
        else if (roll > 990) droppedItem = 'golden_box';   // %0.8
        else if (roll > 940) droppedItem = 'metal_box';    // %5
        else if (roll > 840) droppedItem = 'wooden_box';   // %10
        else if (roll > 690) {                             // %15 Chance for Junk
            const junks = ['plastic_bottle', 'old_boot', 'stick', 'stone', 'copper_wire'];
            droppedItem = junks[Math.floor(Math.random() * junks.length)];
        }

        if (droppedItem) {
            if (!user.inventory) user.inventory = [];
            const existing = user.inventory.find(i => i.itemId === droppedItem);
            if (existing) existing.amount++;
            else user.inventory.push({ itemId: droppedItem, amount: 1 });
        }

        await user.save();

        let description = `${job.emoji} Bugün **${job.text}** tam olarak **${earnings} NexCoin** kazandın!\n\n💰 **Cüzdan:** ${user.balance.toLocaleString()}`;

        if (droppedItem) {
            const itemData = ITEMS[droppedItem];
            description += `\n\n🎁 **Şanslı Günün!** Çalışırken bir **${itemData.emoji} ${itemData.name}** buldun!\nÇantanı kontrol et: \`/inventory\``;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: `${interaction.user.username} işe gitti`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(description)
            .setFooter({ text: 'Tekrar çalışmak için 5 dakika bekle.' });

        await interaction.reply({ embeds: [embed] });
    }
};
