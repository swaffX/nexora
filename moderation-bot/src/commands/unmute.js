const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', 'shared', 'embeds'));
const { Penal } = require(path.join(__dirname, '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Kullanıcının susturmasını (Cezalı Rolü) kaldırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Cezası kaldırılacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Kaldırma sebebi')),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Manuel Kaldırma';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const { MessageFlags } = require('discord.js');
        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Kullanıcı sunucuda bulunamadı (Yine de veritabanından kaldırılacak).')],
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        try {
            // 1. Veritabanındaki Aktif Cezayı Kaldır
            const activePenal = await Penal.findOne({
                guildId: interaction.guild.id,
                userId: user.id,
                type: 'MUTE',
                active: true
            });

            if (activePenal) {
                activePenal.active = false;
                activePenal.endTime = new Date(); // Bitir
                await activePenal.save();
            }

            // 2. Rolü Kaldır
            const MUTE_ROLE_ID = '1464180689611129029'; // Mute.js'teki Rol ID
            let role = interaction.guild.roles.cache.get(MUTE_ROLE_ID) || interaction.guild.roles.cache.find(r => r.name === 'Cezalı');

            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }

            // 3. Timeout Kaldır
            if (member.isCommunicationDisabled()) {
                await member.timeout(null, reason);
            }

            await interaction.editReply({
                embeds: [embeds.success('İşlem Başarılı', `<@${user.id}> adlı kullanıcının susturması kaldırıldı.\n**Sebep:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                embeds: [embeds.error('Hata', `İşlem sırasında hata oluştu: ${error.message}`)]
            });
        }
    }
};
