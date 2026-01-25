const { SlashCommandBuilder, PermissionFlagsBits , MessageFlags } = require('discord.js');
const User = require('../../../../shared/models/User');

const SPECIAL_USERS = ['315875588906680330'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy-manage')
        .setDescription('Yönetici ekonomi işlemleri (Para Ekle/Sil)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Varsayılan olarak adminlere
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Bir kullanıcıya coin ekler.')
                .addUserOption(option => option.setName('user').setDescription('Kullanıcı').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Miktar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Bir kullanıcıdan coin siler.')
                .addUserOption(option => option.setName('user').setDescription('Kullanıcı').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Miktar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Bir kullanıcının parasını ayarlar.')
                .addUserOption(option => option.setName('user').setDescription('Kullanıcı').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('Miktar').setRequired(true).setMinValue(0))),

    async execute(interaction) {
        // Ekstra Güvenlik: Sadece Admin veya Özel ID'ler
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !SPECIAL_USERS.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guild.id;

        const user = await User.findOne({ odasi: targetUser.id, odaId: guildId });

        // Kullanıcı DB'de yoksa oluştur
        let userData = user;
        if (!userData) {
            userData = await User.create({ odasi: targetUser.id, odaId: guildId, username: targetUser.username });
        }

        if (subcommand === 'add') {
            userData.balance += amount;
            await userData.save();
            return interaction.reply({ content: `✅ <@${targetUser.id}> hesabına **${amount}** NexCoin eklendi.\nYeni Bakiye: **${userData.balance}**` });
        }

        if (subcommand === 'remove') {
            userData.balance = Math.max(0, userData.balance - amount);
            await userData.save();
            return interaction.reply({ content: `✅ <@${targetUser.id}> hesabından **${amount}** NexCoin silindi.\nYeni Bakiye: **${userData.balance}**` });
        }

        if (subcommand === 'set') {
            userData.balance = amount;
            await userData.save();
            return interaction.reply({ content: `✅ <@${targetUser.id}> bakiyesi **${amount}** NexCoin olarak ayarlandı.` });
        }
    }
};
