const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');
const ValorantUser = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'ValorantUser'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View your current Valorant rank and stats.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s stats')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const vUser = await ValorantUser.findOne({ userId: targetUser.id });

        if (!vUser) {
            return interaction.editReply({
                content: targetUser.id === interaction.user.id
                    ? '❌ Hesabınız bağlı değil. `/link name:YOURNAME tag:TAG` komutunu kullanarak bağlayın.'
                    : `❌ ${targetUser} kullanıcısının hesabı bağlı değil.`
            });
        }

        try {
            // Unofficial API (HenrikDev)
            // Limitlere dikkat edin. Production için kendi API key'inizi kullanmanız önerilir.
            const apiUrl = `https://api.henrikdev.xyz/valorant/v1/mmr/${vUser.region}/${vUser.riotName}/${vUser.riotTag}`;

            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'NexoraBot/1.0'
                }
            });

            if (response.status !== 200 || !response.data.data) {
                // Eğer hata dönerse (gizli profil vs)
                return interaction.editReply('❌ Oyuncu bulunamadı veya profil gizli. Lütfen isminizi ve etiketinizi kontrol edin.');
            }

            const data = response.data.data;
            // Response Structure: { currenttier, currenttierpatched, ranking_in_tier, mmr_change_to_last_game, elo, images: { small, large, triangle_down, triangle_up } }

            // DB güncelle
            vUser.lastRank = data.currenttierpatched;
            vUser.lastTier = data.currenttier;
            await vUser.save();

            // Rank rengi (basit mapping)
            let color = 0xFFFFFF;
            if (data.currenttierpatched.includes('Iron')) color = 0x585858;
            else if (data.currenttierpatched.includes('Bronze')) color = 0xA57C53;
            else if (data.currenttierpatched.includes('Silver')) color = 0xC0C0C0;
            else if (data.currenttierpatched.includes('Gold')) color = 0xD4AF37;
            else if (data.currenttierpatched.includes('Platinum')) color = 0x3E8E9E;
            else if (data.currenttierpatched.includes('Diamond')) color = 0xB982D8;
            else if (data.currenttierpatched.includes('Ascendant')) color = 0x6AE3A8;
            else if (data.currenttierpatched.includes('Immortal')) color = 0xC72E46;
            else if (data.currenttierpatched.includes('Radiant')) color = 0xFFFFDD;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: `${vUser.riotName}#${vUser.riotTag}`, iconURL: data.images?.small })
                .setTitle(`Rank: ${data.currenttierpatched}`)
                .setThumbnail(data.images?.large)
                .addFields(
                    { name: 'ELO', value: `${data.elo} RR`, inline: true },
                    { name: 'Son Maç Değişimi', value: `${data.mmr_change_to_last_game > 0 ? '+' : ''}${data.mmr_change_to_last_game}`, inline: true },
                    { name: 'Bölge', value: vUser.region.toUpperCase(), inline: true }
                )
                .setFooter({ text: 'Nexora Stats • via henrikdev API' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Stats API Error:', error.response?.status, error.response?.data);

            if (error.response?.status === 404) {
                return interaction.editReply('❌ Kullanıcı API üzerinde bulunamadı. İsmi veya bölgeyi kontrol edin.');
            } else if (error.response?.status === 429) {
                return interaction.editReply('⚠️ API istek limiti aşıldı. Lütfen biraz bekleyin.');
            }

            return interaction.editReply('❌ İstatistikler alınırken API hatası oluştu. Daha sonra tekrar deneyin.');
        }
    }
};
