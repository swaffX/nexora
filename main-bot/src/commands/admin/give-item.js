const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { ITEMS } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'gameData'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-item')
        .setDescription('Bir kullanıcıya eşya veya kutu ver (Yönetici)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Eşyanın verileceği kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Verilecek eşya (ID veya İsim)')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Kaç adet verilecek? (Varsayılan: 1)')
                .setMinValue(1)),

    // Autocomplete for Items
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        // ITEMS object to array
        const choices = Object.values(ITEMS)
            .filter(item => item.name.toLowerCase().includes(focusedValue) || item.id.includes(focusedValue))
            .map(item => ({ name: `${item.emoji} ${item.name}`, value: item.id }))
            .slice(0, 25);

        await interaction.respond(choices);
    },

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkin yok.', flags: MessageFlags.Ephemeral });
        }

        const targetUser = interaction.options.getUser('user');
        const itemId = interaction.options.getString('item');
        const amount = interaction.options.getInteger('amount') || 1;

        // Item Check
        const item = ITEMS[itemId];
        if (!item) {
            return interaction.reply({ content: '❌ Geçersiz eşya IDsi.', flags: MessageFlags.Ephemeral });
        }

        // DB Check
        let user = await User.findOne({ odasi: targetUser.id, odaId: interaction.guild.id });
        if (!user) user = new User({ odasi: targetUser.id, odaId: interaction.guild.id });

        // Add to Inventory
        if (!user.inventory) user.inventory = [];

        const existingSlot = user.inventory.find(i => i.itemId === itemId);
        if (existingSlot) {
            existingSlot.amount += amount;
        } else {
            user.inventory.push({ itemId: itemId, amount: amount });
        }

        await user.save();

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎁 Eşya Gönderildi!')
            .setDescription(`**${targetUser.username}** kullanıcısına başarıyla eşya verildi.`)
            .addFields(
                { name: '📦 Eşya', value: `${item.emoji} ${item.name}`, inline: true },
                { name: '🔢 Adet', value: `${amount}`, inline: true },
                { name: '👤 Alan Kişi', value: `<@${targetUser.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log optional
        // require('../../utils/logger').info(...)
    }
};
