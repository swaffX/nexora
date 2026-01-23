const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

const JOBS = [
    { name: 'Yazılımcı', text: 'kod yazarak', min: 100, max: 500, emoji: '💻' },
    { name: 'Discord Modu', text: 'sunucuyu moder ederek', min: 50, max: 200, emoji: '🛡️' },
    { name: 'Yayıncı', text: 'yayın açarak', min: 200, max: 800, emoji: '🎥' },
    { name: 'Tasarımcı', text: 'logo tasarlayarak', min: 150, max: 600, emoji: '🎨' },
    { name: 'Madenci', text: 'kripto kazarak', min: 300, max: 1000, emoji: '⛏️' },
    { name: 'Barmen', text: 'içki servis ederek', min: 80, max: 300, emoji: '🍺' },
    { name: 'Hacker', text: 'bir bankayı soyarak', min: 1000, max: 2000, chance: 0.1 }, // Rare logic handled explicitly
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

        // Cooldown Check (Örn: 5 Dakika)
        const now = Date.now();
        const cooldownTime = 5 * 60 * 1000;

        // Veritabanına lastWork gibi bir alan eklemek gerekir. 
        // Şimdilik client.cooldowns kullanabiliriz ama restartta sıfırlanır.
        // Veritabanı en sağlıklısıdır.
        // User şemasında 'lastWork' yoksa, eklenmiş varsayalım (Mongoose esnektir).

        if (user.lastWork && now - user.lastWork < cooldownTime) {
            const remaining = cooldownTime - (now - user.lastWork);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return interaction.reply({
                content: `⏳ **Çok yorgunsun!** Tekrar çalışmak için **${minutes}dk ${seconds}sn** beklemelisin.`,
                ephemeral: true
            });
        }

        // Rastgele İş Seçimi
        let job = JOBS[Math.floor(Math.random() * JOBS.length)];

        // Hacker is rare
        if (job.name === 'Hacker' && Math.random() > job.chance) {
            // Fallback to simpler job
            job = JOBS[0];
        }

        const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

        user.balance += earnings;
        user.lastWork = now;

        // %10 Şansla Kutu Düşürme
        let droppedBox = null;
        if (Math.random() < 0.10) {
            droppedBox = 'wooden_box';
            // Inventory init check
            if (!user.inventory) user.inventory = [];

            const existing = user.inventory.find(i => i.itemId === droppedBox);
            if (existing) existing.amount++;
            else user.inventory.push({ itemId: droppedBox, amount: 1 });
        }

        await user.save();

        let description = `${job.emoji} Bugün **${job.text}** tam olarak **${earnings} NexCoin** kazandın!\n\n💰 **Cüzdan:** ${user.balance.toLocaleString()}`;

        if (droppedBox) {
            description += `\n\n🎁 **Şanslı Günün!** Çalışırken yerlerde bir **Ahşap Kutu** 📦 buldun!\nÇantanı kontrol et: \`/inventory\``;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: `${interaction.user.username} işe gitti`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(description)
            .setFooter({ text: 'Tekrar çalışmak için 5 dakika bekle.' });

        await interaction.reply({ embeds: [embed] });
    }
};
