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

            let total = 0;
            let success = 0;
            let failed = 0;

            await interaction.editReply(`🔄 **${allUsers.length}** kullanıcının rankleri senkronize ediliyor... Bu işlem biraz sürebilir.`);

            for (const userDoc of allUsers) {
                total++;
                try {
                    const member = await interaction.guild.members.fetch(userDoc.odasi).catch(() => null);

                    // ZORUNLU VALORANT ROLESİ KONTROLÜ
                    const REQUIRED_VALORANT_ROLE = '1466189076347486268';

                    if (member) {
                        if (member.roles.cache.has(REQUIRED_VALORANT_ROLE)) {
                            const level = userDoc.matchStats.matchLevel || 1;
                            await rankHandler.syncRank(member, level);
                            success++;
                        }
                        // Rolü yoksa HİÇBİR ŞEY yapmıyoruz (User Request: sadece role sahiplerine uygula)
                    }
                } catch (e) {
                    console.error(`Sync error for ${userDoc.odasi}:`, e);
                    failed++;
                }

                // Rate limiting önlemi: Her 5 kullanıcıda bir 1 sn bekle
                if (total % 5 === 0) await new Promise(r => setTimeout(r, 1000));
            }

            await interaction.editReply(`✅ İşlem tamamlandı!\n- **Başarılı:** ${success}\n- **Hatalı:** ${failed}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Bir hata oluştu.');
        }
    },
};
