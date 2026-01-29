const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Kullanıcıyı karantinaya alır (Cezalı)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Cezalandırılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Sebep')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'Sebep belirtilmedi';
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ Bu kullanıcıya işlem yapamazsın.', ephemeral: true });
        }

        const guildSettings = await Guild.findOne({ odaId: interaction.guild.id });
        const jailRoleId = guildSettings?.jailSystem?.roleId;

        if (!jailRoleId) {
            return interaction.reply({ content: '❌ Jail rolü ayarlanmamış. Lütfen kurulum yapın.', ephemeral: true });
        }

        const jailRole = interaction.guild.roles.cache.get(jailRoleId);
        if (!jailRole) {
            return interaction.reply({ content: '❌ Kayıtlı Jail rolü sunucuda bulunamadı.', ephemeral: true });
        }

        try {
            // Kullanıcının eski rollerini kaydetmek için DB işlemi yapılabilir (V2'de eklenebilir)
            // Şimdilik sadece Jail rolü verip diğerlerini alabiliriz. Ancak rolleri silmek riskli.
            // En iyisi sadece Jail rolünü verip, Jail rolünün tüm kanalları engellediğinden emin olmak.
            // Ancak Discord permission mantığında "Deny" baskındır, bu yüzden Jail rolü her kanalda "ViewChannel: False" ise yeterli.
            // Yine de kullanıcıyı etiketleyemesinler diye "Member" rolünü almak yaygındır.

            // Biz şimdilik SADECE Jail rolünü ekleyelim ve Member rolü varsa alalım (Varsayımsal).
            // Daha güvenli: Tüm rolleri alıp Jail'i ver.

            await member.roles.add(jailRole);

            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('⛓️ JAIL')
                .setDescription(`<@${targetUser.id}> karantinaya alındı.`)
                .addFields(
                    { name: 'Sebep', value: reason },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>` }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            try {
                await member.send(`⛓️ **${interaction.guild.name}** sunucusunda karantinaya alındınız.\nSebep: ${reason}`);
            } catch (e) { }

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
        }
    }
};
