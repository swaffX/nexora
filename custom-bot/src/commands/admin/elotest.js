const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elotest')
        .setDescription('ELO kartını test eder (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Kartını görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // User Doc Çek
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Stats Hazırla
            let stats = eloService.createDefaultStats();
            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                stats = userDoc.matchStats;
                if (userDoc.isModified('matchStats')) await userDoc.save();
            }

            // Rank Hesaplama
            const userRank = await User.countDocuments({
                odaId: guildId,
                'matchStats.totalMatches': { $gt: 0 },
                'matchStats.elo': { $gt: stats.elo }
            }) + 1;

            // Görsel Oluştur
            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' }),
                backgroundImage: userDoc?.backgroundImage,
                favoriteAgent: userDoc?.favoriteAgent,
                favoriteMap: userDoc?.favoriteMap
            };

            const buffer = await canvasGenerator.createEloCard(userForCard, stats, userRank);
            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('ELO Test Hatası:', error);
            await interaction.editReply({ content: '❌ Hata: ' + error.message });
        }
    }
};
