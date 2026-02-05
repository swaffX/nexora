const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const rankHandler = require('../../handlers/rankHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-ranks')
        .setDescription('Tüm kullanıcıların ELO rank rollerini senkronize eder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Önce rolleri kontrol et
            await rankHandler.ensureRolesExist(interaction.guild);

            const allUsers = await User.find({
                'matchStats.matchLevel': { $gte: 1 },
                odaId: interaction.guild.id
            });

            let success = 0;
            let failed = 0;

            await interaction.editReply(`🔄 ${allUsers.length} kullanıcının rankleri senkronize ediliyor... Bu biraz sürebilir.`);

            for (const userDoc of allUsers) {
                try {
                    const member = await interaction.guild.members.fetch(userDoc.odasi).catch(() => null);
                    if (member) {
                        const level = userDoc.matchStats.matchLevel || 1;
                        await rankHandler.syncRank(member, level);
                        success++;
                    } else {
                        // Üye sunucudan çıkmış (görmezden gel)
                    }
                } catch (e) {
                    console.error(`Sync error for ${userDoc.odasi}:`, e);
                    failed++;
                }

                // Rate limit yememek için kısa bekleme (her 10 kullanıcıda bir)
                if (success % 10 === 0) await new Promise(r => setTimeout(r, 500));
            }

            await interaction.editReply(`✅ İşlem tamamlandı!\n- **Başarılı:** ${success}\n- **Hatalı:** ${failed}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Bir hata oluştu.');
        }
    },
};
