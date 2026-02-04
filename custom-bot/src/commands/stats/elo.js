const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Kendi ELO ve Level durumunu resimli kart olarak gösterir.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Başka bir kullanıcının istatistiklerini gör')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Hedef kullanıcıyı belirle
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Kullanıcı bilgilerini hazırla
            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' })
            };

            let stats = userDoc ? userDoc.matchStats : { elo: 100, matchLevel: 1 };

            // LEGACY FIX: Eğer maç sayısı 0 ise ve ELO 1000 ise (Eski sistem), bunu 100'e çek.
            if (stats.totalMatches === 0 && stats.elo === 1000) {
                stats.elo = 100;
                stats.matchLevel = 1;
                // Veritabanını güncelle
                if (userDoc) {
                    userDoc.matchStats.elo = 100;
                    userDoc.matchStats.matchLevel = 1;
                    await userDoc.save();
                }
            }

            // Resmi Üret
            const buffer = await canvasGenerator.createEloCard(userForCard, stats);
            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('ELO Command Error:', error);
            await interaction.editReply({ content: 'Bir hata oluştu. (Canvas modülünün yüklü olduğundan emin olun.)' });
        }
    }
};
