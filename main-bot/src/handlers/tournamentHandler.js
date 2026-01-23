const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const { Tournament, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

/**
 * 🏆 NEXORA TOURNAMENT SYSTEM
 * Otomatik kura, eşleşme ve turnuva yönetimi.
 */

async function handleSetup(interaction) {
    // Modal ile isim ve ödül al (Komut dosyasından buraya veriyi taşıyacağız veya modal handler'da işleyeceğiz)
    // Şimdilik interaction bir modal submit ise:
    const name = interaction.fields.getTextInputValue('tour_name');
    const prize = interaction.fields.getTextInputValue('tour_prize');

    const tournament = await Tournament.create({
        guildId: interaction.guild.id,
        name: name,
        prize: prize,
        createdBy: interaction.user.id,
        status: 'WAITING'
    });

    const embed = new EmbedBuilder()
        .setColor('#FFD700') // Gold
        .setTitle(`🏆 ${name} Turnuvası`)
        .setDescription(`Nexora Arena yeni bir şampiyon arıyor!\n\n🎁 **Ödül:** ${prize}\n👥 **Katılımcı:** 0\n\nKatılmak için aşağıdaki butona tıkla!`)
        .setImage('https://media.discordapp.net/attachments/111111111/tournament_banner.png') // Placeholder
        .setFooter({ text: `Turnuva ID: ${tournament._id}` });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tour_join_${tournament._id}`)
                .setLabel('Turnuvaya Katıl')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚔️'),
            new ButtonBuilder()
                .setCustomId(`tour_leave_${tournament._id}`)
                .setLabel('Ayrıl')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleJoin(interaction, tournamentId) {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return interaction.reply({ content: '❌ Turnuva bulunamadı (Silinmiş olabilir).', ephemeral: true });

    if (tournament.status !== 'WAITING') return interaction.reply({ content: '❌ Kayıtlar kapandı!', ephemeral: true });

    // Zaten katıldı mı?
    if (tournament.participants.some(p => p.userId === interaction.user.id)) {
        return interaction.reply({ content: '✅ Zaten katılımcı listesindesin.', ephemeral: true });
    }

    // Katılımcıyı ekle
    tournament.participants.push({
        userId: interaction.user.id,
        username: interaction.user.username
    });
    await tournament.save();

    await interaction.reply({ content: '🎉 Başarıyla turnuvaya kayıt oldun! Eşleşmeleri bekle.', ephemeral: true });

    // Embed'i güncelle (Katılımcı sayısı)
    // (Mesajı bulup editlemek complex olabilir, şimdilik pas)
}

async function handleLeave(interaction, tournamentId) {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return;

    const index = tournament.participants.findIndex(p => p.userId === interaction.user.id);
    if (index === -1) return interaction.reply({ content: 'Zaten listede yoksun.', ephemeral: true });

    tournament.participants.splice(index, 1);
    await tournament.save();

    await interaction.reply({ content: 'Turnuvadan ayrıldın.', ephemeral: true });
}

async function startTournament(interaction, tournamentId) {
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return interaction.reply({ content: 'Turnuva yok.', ephemeral: true });

    if (tournament.participants.length < 2) return interaction.reply({ content: '❌ Yeterli katılım yok (Min 2).', ephemeral: true });

    tournament.status = 'ACTIVE';

    // 1. Karıştır (Shuffle)
    const shuffled = tournament.participants.sort(() => 0.5 - Math.random());

    // 2. Eşleştir (Brackets)
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        const p1 = shuffled[i];
        const p2 = shuffled[i + 1] || null; // Eğer tek sayıysa p2 null (BYE geçer)

        matches.push({
            round: 1,
            player1: p1.userId,
            player2: p2 ? p2.userId : null,
            winner: p2 ? null : p1.userId // Rakip yoksa direkt kazanır
        });
    }

    tournament.matches = matches;
    tournament.currentRound = 1;
    await tournament.save();

    // 3. Görselleştirme (Text Bracket)
    let bracketText = '';
    matches.forEach((m, index) => {
        const p1Name = tournament.participants.find(p => p.userId === m.player1).username;
        const p2Name = m.player2 ? tournament.participants.find(p => p.userId === m.player2).username : 'BAY (Otomatik Tur)';

        bracketText += `**Maç ${index + 1}:** 🔴 ${p1Name} 🆚 🔵 ${p2Name}\n`;
    });

    const embed = new EmbedBuilder()
        .setColor('#FF4500')
        .setTitle(`🥊 ${tournament.name} - Round 1 Eşleşmeleri`)
        .setDescription(bracketText)
        .addFields({ name: 'Nasıl İlerler?', value: 'Maçlar bittikçe yetkililer `/tournament win` komutu ile kazananı belirleyecek.' });

    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    handleSetup,
    handleJoin,
    handleLeave,
    startTournament
};
