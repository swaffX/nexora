const { SlashCommandBuilder, EmbedBuilder , MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS, ItemType } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('Vahşi doğada (Siber Orman) avlan.'),

    async execute(interaction) {
        // Cooldown check (Örn 10 dk)
        // Basit cooldown (Map)
        if (!interaction.client.huntCooldowns) interaction.client.huntCooldowns = new Map();
        const now = Date.now();
        const cooldownAmount = 10 * 60 * 1000;

        if (interaction.client.huntCooldowns.has(interaction.user.id)) {
            const expiration = interaction.client.huntCooldowns.get(interaction.user.id) + cooldownAmount;
            if (now < expiration) {
                const timeLeft = (expiration - now) / 1000;
                return interaction.reply({ content: `🕒 Avlanmak için **${Math.ceil(timeLeft / 60)} dakika** beklemelisin.`, flags: MessageFlags.Ephemeral });
            }
        }

        interaction.client.huntCooldowns.set(interaction.user.id, now);

        // --- LOGIC ---
        const user = await User.findOne({ odasi: interaction.user.id, odaId: interaction.guild.id });
        if (!user.inventory) user.inventory = [];

        // Bonus Hesabı (Active Pet)
        let luckBonus = 0;
        if (user.activePet && ITEMS[user.activePet].bonus.type === 'luck') {
            luckBonus = ITEMS[user.activePet].bonus.amount; // Örn 5
        }

        const roll = Math.random() * 100;

        // %30 Hiçbir şey, %40 Para, %25 Eşya, %5 PET!
        // Luck bonusu düşme şansını artırır (roll'u düşürür veya thresholdları kaydırır).
        // Biz basitçe roll'a bonus ekleyelim (daha yüksek roll daha iyi olsun)

        const finalRoll = roll + luckBonus;

        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('🏹 Avlanma Raporu');

        if (finalRoll < 30) {
            // Boş
            embed.setDescription('Ormanda dolaştın ama sadece paslı vidalar gördün. Hiçbir şey bulamadın. 🕸️')
                .setColor('#95a5a6');
        } else if (finalRoll < 70) {
            // Para
            const coins = Math.floor(Math.random() * 200) + 50;
            user.balance += coins;
            embed.setDescription(`Bozuk bir droid buldun ve parçalarını hurdacıya sattın.\n💰 **+${coins} NexCoin** kazandın.`);
        } else if (finalRoll < 95) {
            // Eşya (Stick, Stone, etc)
            const commonItems = ['stick', 'stone', 'iron'];
            const randItem = commonItems[Math.floor(Math.random() * commonItems.length)];
            const item = ITEMS[randItem];

            // Add inventory
            const existing = user.inventory.find(i => i.itemId === randItem);
            if (existing) existing.amount++;
            else user.inventory.push({ itemId: randItem, amount: 1 });

            embed.setDescription(`Yerde ${item.emoji} **${item.name}** buldun!`);
        } else {
            // JACKPOT: PET veya KUTU!
            const jackpotItems = ['robo_dog', 'mk1_drone', 'wooden_box'];
            const randItem = jackpotItems[Math.floor(Math.random() * jackpotItems.length)];
            const item = ITEMS[randItem];

            const existing = user.inventory.find(i => i.itemId === randItem);
            if (existing) existing.amount++;
            else user.inventory.push({ itemId: randItem, amount: 1 });

            embed.setColor('#f1c40f')
                .setImage('https://media.tenor.com/_d222tL7A9QAAAAC/robot-dance.gif') // Fun robot gif
                .setDescription(`🚨 **İNANILMAZ!** 🚨\nVahşi bir ${item.emoji} **${item.name}** ile karşılaştın ve onu yakaladın!`);
        }

        await user.save();
        await interaction.reply({ embeds: [embed] });
    }
};
