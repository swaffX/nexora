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

            // --- RANK HESAPLAMA (Leaderboard ile Uyumlu) ---
            let userRank = 'Unranked';
            try {
                // 1. Tüm geçerli kayıtları çek
                const allDocs = await User.find({ odaId: guildId, 'matchStats.elo': { $exists: true } })
                    .select('odasi matchStats.elo')
                    .sort({ 'matchStats.elo': -1 });

                // 2. Rol kontrolü için ID listesi
                const userIds = allDocs.map(d => d.odasi);

                // 3. Toplu Member Fetch (Rate limit dostu)
                const members = await interaction.guild.members.fetch({ user: userIds }).catch(() => new Map());

                // 4. Role sahip olanları filtrele ve sıralı listeyi oluştur
                let rankCounter = 1;
                for (const doc of allDocs) {
                    const m = members.get(doc.odasi);
                    if (m && m.roles.cache.has(REQUIRED_ROLE_ID)) {
                        if (doc.odasi === targetUser.id) {
                            userRank = rankCounter;
                            break;
                        }
                        rankCounter++;
                    }
                }
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
