const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regen-match')
        .setDescription('Maç ID\'si ile maç sonucu görselini yeniden oluştur')
        .addStringOption(opt =>
            opt.setName('match_id')
                .setDescription('Maç ID\'si (örn: 1234567890123456789)')
                .setRequired(true))
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Görselin gönderileceği kanal (boş bırakılırsa buraya gönderilir)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const matchId = interaction.options.getString('match_id');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            // 1. Maçı bul
            const match = await Match.findOne({ matchId });
            if (!match) {
                return interaction.editReply(`❌ **Hata:** \`${matchId}\` ID'li maç bulunamadı.`);
            }

            if (match.status !== 'FINISHED') {
                return interaction.editReply(`⚠️ Bu maç henüz tamamlanmamış. Durum: \`${match.status}\``);
            }

            // 2. Oyuncu verilerini hazırla
            const playersData = {};
            const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];

            for (const pid of allPlayers) {
                try {
                    const member = await interaction.guild.members.fetch(pid).catch(() => null);
                    if (member) {
                        playersData[pid] = {
                            username: member.displayName || member.user.username,
                            avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true })
                        };
                    } else {
                        // Kullanıcı sunucuda değilse
                        const user = await interaction.client.users.fetch(pid).catch(() => null);
                        playersData[pid] = {
                            username: user?.username || 'Unknown',
                            avatarURL: user?.displayAvatarURL({ extension: 'png', size: 128 }) || null
                        };
                    }
                } catch (e) {
                    playersData[pid] = { username: 'Unknown', avatarURL: null };
                }
            }

            // 3. ELO değişikliklerini al
            const eloChanges = match.eloChanges || [];

            // 4. Match data hazırla (her iki format için uyumlu)
            const matchData = {
                matchId: match.matchId,
                matchNumber: match.matchNumber,
                selectedMap: match.selectedMap,
                map: match.selectedMap,
                scoreA: match.scoreA,
                scoreB: match.scoreB,
                score: { A: match.scoreA, B: match.scoreB },
                teamA: match.teamA,
                teamB: match.teamB,
                teams: { A: match.teamA, B: match.teamB },
                mvpPlayerId: match.mvpPlayerId,
                mvpLoserId: match.mvpLoserId,
                mvp: match.mvpPlayerId,
                loserMvp: match.mvpLoserId,
                winner: match.winner
            };

            // 5. Görsel oluştur
            const buffer = await canvasGenerator.createMatchResultImage(matchData, eloChanges, playersData);
            const attachment = new AttachmentBuilder(buffer, { name: `match-result-${matchId}.png` });

            // 6. Hedef kanala gönder
            await targetChannel.send({
                content: `📊 **Maç Sonucu** (ID: \`${matchId}\`)`,
                files: [attachment]
            });

            await interaction.editReply({
                content: `✅ **Başarılı!** Maç görseli ${targetChannel} kanalına gönderildi.\n\n` +
                    `**Maç Bilgileri:**\n` +
                    `• ID: \`${matchId}\`\n` +
                    `• Harita: ${match.selectedMap || 'Bilinmiyor'}\n` +
                    `• Skor: ${match.scoreA} - ${match.scoreB}\n` +
                    `• Kazanan: Team ${match.winner || 'Belirsiz'}`
            });

        } catch (error) {
            console.error('Regen Match Error:', error);
            await interaction.editReply(`❌ Bir hata oluştu: ${error.message}`);
        }
    }
};
