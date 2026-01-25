const cooldowns = new Set();

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lastmatch')
        .setDescription('View details of the last Valorant match played')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Riot ID (Name#Tag)')
                .setRequired(true)),

    async execute(interaction) {
        if (cooldowns.has(interaction.user.id)) return interaction.reply({ content: '⏳ Biraz yavaş ol dostum (30sn bekle).', ephemeral: true });

        await interaction.deferReply();
        cooldowns.add(interaction.user.id);
        setTimeout(() => cooldowns.delete(interaction.user.id), 30000);

        const riotId = interaction.options.getString('name');

        let name, tag;
        if (riotId.includes('#')) {
            [name, tag] = riotId.split('#');
        } else {
            return interaction.editReply({ content: '❌ Lütfen `İsim#Tag` formatında girin. (Örn: Swaff#TR1)' });
        }

        try {
            // HenrikDev API v3 Matches
            const res = await axios.get(`https://api.henrikdev.xyz/valorant/v3/matches/eu/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=1`, {
                headers: { 'User-Agent': 'NexoraBot/1.0' }
            });

            if (!res.data.data || res.data.data.length === 0) {
                return interaction.editReply('❌ Maç geçmişi bulunamadı veya profil gizli.');
            }

            const match = res.data.data[0];
            const meta = match.metadata;

            // Oyuncuyu bul
            const player = match.players.all_players.find(p =>
                p.name.toLowerCase() === name.toLowerCase() &&
                p.tag.toLowerCase() === tag.toLowerCase()
            );

            if (!player) return interaction.editReply('❌ Maç verisi var ama oyuncu verisi eşleşmedi.');

            // Takım Rengi ve Sonuç
            const isBlue = player.team === 'Blue';
            const roundsWon = isBlue ? match.teams.blue.rounds_won : match.teams.red.rounds_won;
            const roundsLost = isBlue ? match.teams.red.rounds_won : match.teams.blue.rounds_won;
            const isWinner = roundsWon > roundsLost; // Basit mantık, draw olabilir

            const color = isWinner ? 0x00FF00 : 0xFF0000;
            const agentUrl = player.assets.agent.small;

            // HS Oranı
            const totalShots = player.stats.headshots + player.stats.bodyshots + player.stats.legshots;
            const hsPercent = totalShots > 0 ? Math.round((player.stats.headshots / totalShots) * 100) : 0;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: `Son Maç: ${meta.map}`, iconURL: 'https://img.icons8.com/color/48/valorant.png' })
                .setTitle(`${name} #${tag}`)
                .setDescription(`**Sonuç:** ${isWinner ? 'Kazandı 🏆' : 'Kaybetti ❌'} (${roundsWon} - ${roundsLost})`)
                .setThumbnail(agentUrl)
                .addFields(
                    { name: '🎮 Ajan', value: player.character, inline: true },
                    { name: '🔫 K/D/A', value: `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`, inline: true },
                    { name: '🎯 HS %', value: `%${hsPercent}`, inline: true },
                    { name: '💥 Hasar/Tur', value: `${Math.round(player.damage_made / meta.rounds_played)}`, inline: true },
                    { name: '💯 Skor', value: `${player.stats.score}`, inline: true },
                    { name: '⏰ Tarih', value: `<t:${Math.floor(meta.game_start)}:R>`, inline: true }
                )
                .setFooter({ text: `Mod: ${meta.mode} • Sunucu: ${meta.cluster}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Lastmatch Error:', error.message);
            await interaction.editReply({ content: '❌ Maç verisi alınamadı. (API Hatası veya Profil Gizli)' });
        }
    }
};
