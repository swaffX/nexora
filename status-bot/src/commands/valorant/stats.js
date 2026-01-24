const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View Valorant player statistics')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Riot ID (Name#Tag)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const riotId = interaction.options.getString('name');

        // Split Name#Tag
        let name, tag;
        if (riotId.includes('#')) {
            [name, tag] = riotId.split('#');
        } else {
            return interaction.editReply({ content: '❌ Lütfen `İsim#Tag` formatında girin. (Örn: Swaff#TR1)' });
        }

        try {
            // 1. Account Data
            const accountRes = await axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, {
                headers: { 'User-Agent': 'NexoraBot/1.0' }
            });

            if (accountRes.status !== 200) throw new Error('Account not found');
            const acc = accountRes.data.data;

            // 2. MMR (Rank) Data - EU Region varsayılan
            let rankText = 'Unranked';
            let elo = 0;
            let rankImage = '';

            try {
                const mmrRes = await axios.get(`https://api.henrikdev.xyz/valorant/v2/mmr/eu/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, {
                    headers: { 'User-Agent': 'NexoraBot/1.0' }
                });

                if (mmrRes.data.data && mmrRes.data.data.current_data) {
                    rankText = mmrRes.data.data.current_data.currenttierpatched;
                    elo = mmrRes.data.data.current_data.elo;
                    rankImage = mmrRes.data.data.current_data.images?.small; // Rank Icon
                }
            } catch (e) {
                // MMR bulunamadı (Unranked veya Profil Gizli)
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF4655)
                .setAuthor({ name: 'Valorant Profile', iconURL: 'https://img.icons8.com/color/48/valorant.png' })
                .setTitle(`${acc.name} #${acc.tag}`)
                .setThumbnail(rankImage || acc.card.small)
                .setDescription(`**Level:** ${acc.account_level}\n**Region:** ${acc.region.toUpperCase()}`)
                .addFields(
                    { name: '🏆 Rank', value: rankText, inline: true },
                    { name: '📈 ELO', value: `${elo}`, inline: true },
                    { name: '🗓️ Son Güncelleme', value: `${acc.last_update}`, inline: false }
                )
                .setImage(acc.card.wide)
                .setFooter({ text: 'Powered by HenrikDev API' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Valorant Stats Error:', error.message);
            await interaction.editReply({ content: '❌ Oyuncu bilgileri alınamadı. İsmi doğru yazdığından ve profilin herkese açık olduğundan emin ol.' });
        }
    }
};
