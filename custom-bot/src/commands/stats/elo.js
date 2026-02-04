const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Kendi veya başka bir kullanıcının ELO kartını gösterir.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('İstatistiklerini görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // ROL KONTROLÜ (Bu role sahip değilse sistemde yok sayılır)
            const REQUIRED_ROLE_ID = '1466189076347486268';
            let member = null;
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                return interaction.reply({
                    content: `❌ **Hata:** Kullanıcı sunucuda bulunamadı.`,
                    ephemeral: true
                });
            }

            if (!member || !member.roles.cache.has(REQUIRED_ROLE_ID)) {
                return interaction.reply({
                    content: `❌ **Erişim Reddedildi:** Bu kullanıcının ELO sistemine dahil olması için <@&${REQUIRED_ROLE_ID}> rolüne sahip olması gerekir.`,
                    ephemeral: true
                });
            }

            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' })
            };

            // Varsayılan Statlar (eloService kullanarak)
            let stats = eloService.createDefaultStats();

            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                stats = userDoc.matchStats;
                await userDoc.save(); // Düzeltmeleri kaydet
            }

            // Resmi Üret
            const buffer = await canvasGenerator.createEloCard(userForCard, stats);
            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card.png' });

            await interaction.reply({ files: [attachment] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
        }
    }
};
