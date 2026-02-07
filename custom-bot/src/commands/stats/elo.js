const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('ELO ve istatistik kartınızı görüntüler.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Kartını görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // ROL KONTROLÜ
            const REQUIRED_ROLE_ID = '1466189076347486268';
            let member = null;
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                return interaction.editReply({ content: `❌ **Hata:** Kullanıcı sunucuda bulunamadı.` });
            }

            if (!member || !member.roles.cache.has(REQUIRED_ROLE_ID)) {
                return interaction.editReply({ content: `❌ **Erişim Reddedildi:** Bu kullanıcının ELO sistemine dahil olması için <@&${REQUIRED_ROLE_ID}> rolüne sahip olması gerekir.` });
            }

            // User Doc Çek
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Stats Hazırla
            let stats = eloService.createDefaultStats();
            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                stats = userDoc.matchStats;
                if (userDoc.isModified('matchStats')) await userDoc.save();
            }

            // --- RANK HESAPLAMA (Sadece Rol Sahipleri Arasında) ---
            let userRank = 'Unranked';
            try {
                const REQUIRED_ROLE_ID = '1466189076347486268';

                // 1. Rol sahiplerini çek
                const roleMembers = await interaction.guild.members.fetch({ role: REQUIRED_ROLE_ID }).catch(() => new Map());
                const roleMemberIds = Array.from(roleMembers.keys());

                // 2. Rol sahipleri içinden ELO'su seninkinden yüksek olanları say
                const higherEloCount = await User.countDocuments({
                    odaId: guildId,
                    odasi: { $in: roleMemberIds },
                    'matchStats.elo': { $gt: stats.elo }
                });

                userRank = higherEloCount + 1;
            } catch (e) {
                console.error('Rank calc error:', e);
            }
            // ---------------------

            // GÖRSEL OLUŞTUR
            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' })
            };

            // Pass userRank to generate visuals
            const buffer = await canvasGenerator.createEloCard(userForCard, stats, userRank);

            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card.png' });

            // Sadece görseli gönder
            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('ELO Komutu Hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        }
    }
};
