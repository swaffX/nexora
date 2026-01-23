const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('NEXORA Bot Yardım Menüsü'),
    async execute(interaction) {

        const bannerUrl = 'https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6974bad2&is=69736952&hm=16b14c0c7fa6d91ad8528683d2876891b5833d4d516ef5891cd91bc4b8c9804d&';

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('NEXORA Yardım Merkezi')
            .setDescription('Aşağıdaki menüden yardım almak istediğiniz kategoriyi seçiniz.')
            .setImage(bannerUrl)
            .setFooter({ text: 'Nexora System', iconURL: interaction.guild.iconURL() });

        const select = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Yardım almak için bir kategori seçiniz.')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ana Komutlar')
                    .setDescription('Genel bot komutları ve işlevleri.')
                    .setValue('main_commands')
                    .setEmoji('🏠'), // Emojileri sunucuya göre güncellemek gerekebilir
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ekonomi Sistemi')
                    .setDescription('Coin, bakiye ve market sistemi komutları.')
                    .setValue('economy_commands')
                    .setEmoji('💰'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('5v5 Maç Sistemi')
                    .setDescription('Maç kurulumu, bahis ve turnuva komutları.')
                    .setValue('match_commands')
                    .setEmoji('⚔️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Seviye Sistemi')
                    .setDescription('Rank, XP ve liderlik tablosu.')
                    .setValue('level_commands')
                    .setEmoji('📈'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Kullanıcı & Profil')
                    .setDescription('Profil düzenleme ve kullanıcı komutları.')
                    .setValue('user_commands')
                    .setEmoji('👤')
            );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
