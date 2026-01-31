const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role-migration')
        .setDescription('Toplu rol değiştirme işlemi (Tek seferlik)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // İşlem uzun sürebilir
        await interaction.deferReply();

        const OLD_ROLE_ID = '1463875341553635553';
        const NEW_ROLE_ID = '1463875340513317089';

        const guild = interaction.guild;
        const oldRole = guild.roles.cache.get(OLD_ROLE_ID);
        const newRole = guild.roles.cache.get(NEW_ROLE_ID);

        if (!oldRole || !newRole) {
            return interaction.editReply('❌ Rollerden biri veya ikisi bulunamadı!');
        }

        await interaction.editReply('⏳ Üyeler getiriliyor ve işlem başlıyor... Bu işlem sunucu boyutuna göre zaman alabilir.');

        try {
            // Tüm üyeleri çek
            const members = await guild.members.fetch();

            // Eski role sahip üyeleri filtrele
            const targetMembers = members.filter(m => m.roles.cache.has(OLD_ROLE_ID));
            const total = targetMembers.size;

            if (total === 0) {
                return interaction.editReply('❌ Bu role sahip kimse bulunamadı.');
            }

            let successCount = 0;
            let errorCount = 0;

            // İlerlemeyi göstermek için log mesajı
            let statusMsg = await interaction.channel.send(`🔄 İşlem Başladı: 0/${total} üye işlendi.`);

            let count = 0;
            for (const [id, member] of targetMembers) {
                try {
                    // Rolleri değiştir
                    await member.roles.remove(OLD_ROLE_ID);
                    await member.roles.add(NEW_ROLE_ID);
                    successCount++;
                } catch (e) {
                    console.error(`Rol değiştirme hatası (${member.user.tag}):`, e);
                    errorCount++;
                }

                count++;
                // Her 25 üyede bir durumu güncelle ve biraz bekle (Rate Limit koruması)
                if (count % 25 === 0) {
                    await statusMsg.edit(`🔄 İşlem devam ediyor: ${count}/${total} (Hata: ${errorCount})`);
                    await new Promise(r => setTimeout(r, 2000)); // 2 saniye bekle
                } else {
                    await new Promise(r => setTimeout(r, 100)); // Her işlem arası 100ms
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Rol Migrasyonu Tamamlandı')
                .addFields(
                    { name: 'Toplam Hede', value: `${total}`, inline: true },
                    { name: 'Başarılı', value: `${successCount}`, inline: true },
                    { name: 'Hatalı', value: `${errorCount}`, inline: true }
                )
                .setFooter({ text: 'Main Bot • Role Migration Tool' })
                .setTimestamp();

            await statusMsg.delete().catch(() => { });
            await interaction.editReply({ content: 'İşlem Bitti!', embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Bir hata oluştu.');
        }
    }
};
