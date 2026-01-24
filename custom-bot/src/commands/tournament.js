const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const path = require('path');
const { Tournament } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const tournamentHandler = require(path.join(__dirname, '..', '..', 'handlers', 'tournamentHandler'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tournament')
        .setDescription('Turnuva Sistemini Yönet')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('create').setDescription('Yeni bir turnuva oluştur'))
        .addSubcommand(sub =>
            sub.setName('start').setDescription('Kayıtları kapat ve turnuvayı başlat')
                .addStringOption(opt => opt.setName('id').setDescription('Turnuva ID (Son oluşturulan boşsa)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('win').setDescription('Maç kazananını belirle')
                .addStringOption(opt => opt.setName('winner').setDescription('Kazanan Kullanıcı ID').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // 1. OLUŞTURMA (Modal Açar)
        if (subcommand === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('modal_tournament_create')
                .setTitle('Yeni Turnuva Oluştur');

            const nameInput = new TextInputBuilder()
                .setCustomId('tour_name')
                .setLabel('Turnuva Adı')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const prizeInput = new TextInputBuilder()
                .setCustomId('tour_prize')
                .setLabel('Ödül')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row1 = new ActionRowBuilder().addComponents(nameInput);
            const row2 = new ActionRowBuilder().addComponents(prizeInput);

            modal.addComponents(row1, row2);
            await interaction.showModal(modal);
        }

        // 2. BAŞLATMA
        if (subcommand === 'start') {
            // ID verilmediyse en son WAITING olanı bul
            let tourId = interaction.options.getString('id');
            if (!tourId) {
                const lastTour = await Tournament.findOne({ guildId: interaction.guild.id, status: 'WAITING' }).sort({ createdAt: -1 });
                if (lastTour) tourId = lastTour._id;
            }

            if (!tourId) return interaction.reply({ content: '❌ Başlatılacak aktif bir kayıt bulunamadı.', ephemeral: true });

            await tournamentHandler.startTournament(interaction, tourId);
        }

        // 3. KAZANAN BELİRLEME (Basit Versiyon)
        if (subcommand === 'win') {
            // Bu kısım çok detaylı, V2'de geliştirilmeli.
            // Şimdilik sadece manuel duyuru.
            const winnerId = interaction.options.getString('winner');
            await interaction.reply(`🏆 Turnuva kazananı sistemi V2'de eklenecek. Şimdilik manuel duyuru yapın: <@${winnerId}> kazandı!`);
        }
    }
};
