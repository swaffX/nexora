const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChannelType,
    PermissionsBitField,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ComponentType
} = require('discord.js');

const MAPS = [
    'Ascent', 'Bind', 'Breeze', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'
];

const MATCH_CATEGORY_ID = '1463883244436197397';

// Bellekte maç verisi tutuyoruz
const activeMatches = new Map();

module.exports = {
    async handleInteraction(interaction, client) {
        const { customId } = interaction;
        const parts = customId.split('_');
        const action = parts[1]; // create, captainA, captainB, pick, start

        if (action === 'create') {
            await this.createLobby(interaction);
        } else if (action === 'captainA') {
            await this.selectCaptain(interaction, 'A');
        } else if (action === 'captainB') {
            await this.selectCaptain(interaction, 'B');
        } else if (action === 'pick') {
            await this.handlePlayerPick(interaction);
        }
    },

    // 1. ADIM: Admin paneli açar, Takım A ve Takım B Kaptanlarını seçer
    async createLobby(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('👑 Kaptan Seçimi')
            .setDescription('Lütfen Takım A ve Takım B kaptanlarını belirleyin.')
            .addFields(
                { name: 'Kaptan A', value: 'Seçilmedi', inline: true },
                { name: 'Kaptan B', value: 'Seçilmedi', inline: true }
            );

        const rowA = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('match_captainA')
                .setPlaceholder('Takım A Kaptanını Seç')
                .setMaxValues(1)
        );

        const rowB = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('match_captainB')
                .setPlaceholder('Takım B Kaptanını Seç')
                .setMaxValues(1)
        );

        const matchId = interaction.id;
        activeMatches.set(matchId, {
            captainA: null,
            captainB: null,
            teamA: [],
            teamB: [],
            pickTurn: 'A', // Sıra kimde? A başlar
            availablePlayers: [], // Kalan oyuncular (ses kanalındakiler)
            hostId: interaction.user.id,
        });

        await interaction.reply({
            content: `Match ID: ${matchId}`,
            embeds: [embed],
            components: [rowA, rowB],
            ephemeral: true
        });
    },

    async selectCaptain(interaction, team) {
        const matchId = interaction.message.content.split('Match ID: ')[1];
        const matchData = activeMatches.get(matchId);
        if (!matchData) return interaction.reply({ content: 'Hata: Maç verisi yok.', ephemeral: true });

        const selectedId = interaction.values[0];

        if (team === 'A') {
            matchData.captainA = selectedId;
            matchData.teamA = [selectedId]; // Kaptan takıma dahildir
            // Kaptan B ile aynı olamaz
            if (matchData.captainB === selectedId) {
                return interaction.reply({ content: 'Aynı kişi iki takımın kaptanı olamaz!', ephemeral: true });
            }
        } else {
            matchData.captainB = selectedId;
            matchData.teamB = [selectedId];
            if (matchData.captainA === selectedId) {
                return interaction.reply({ content: 'Aynı kişi iki takımın kaptanı olamaz!', ephemeral: true });
            }
        }

        activeMatches.set(matchId, matchData);

        // Embed güncelle
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const captainName = (await interaction.guild.members.fetch(selectedId)).displayName;

        if (team === 'A') embed.fields[0].value = captainName;
        else embed.fields[1].value = captainName;

        // İkisi de seçildiyse "Draft Modu"na geç
        if (matchData.captainA && matchData.captainB) {
            await this.startDraftMode(interaction, matchId);
        } else {
            await interaction.update({ embeds: [embed] });
        }
    },

    // 2. ADIM: Draft Modu - Kaptanlar sırayla oyuncu seçer
    async startDraftMode(interaction, matchId) {
        const matchData = activeMatches.get(matchId);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.update({ content: '❌ Hata: Komutu kullanan kişi bir ses kanalında değil. Oyuncu havuzu oluşturulamadı.', components: [] });
        }

        // Ses kanalındaki diğer oyuncuları havuza ekle (Kaptanlar ve Bot hariç)
        const players = voiceChannel.members
            .filter(m => !m.user.bot && m.id !== matchData.captainA && m.id !== matchData.captainB)
            .map(m => ({ label: m.displayName, value: m.id, emoji: '👤' }));

        if (players.length < 1) { // Normalde 8 olmalı (5v5 için), test için 1'e izin veriyoruz
            // return interaction.update({ content: '❌ Hata: Ses kanalında yeterli oyuncu yok!', components: [] });
        }

        matchData.availablePlayers = players;
        activeMatches.set(matchId, matchData);

        await this.updateDraftUI(interaction, matchId);
    },

    async updateDraftUI(interaction, matchId) {
        const matchData = activeMatches.get(matchId);

        // Kalan oyuncu yoksa veya takımlar dolduysa maçı başlat
        if (matchData.teamA.length >= 5 && matchData.teamB.length >= 5 || matchData.availablePlayers.length === 0) {
            return this.startMatch(interaction, matchId);
        }

        const currentTurnCaptain = matchData.pickTurn === 'A' ? matchData.captainA : matchData.captainB;

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('👥 Oyuncu Seçimi (Draft)')
            .setDescription(`Sıra: <@${currentTurnCaptain}> (Takım ${matchData.pickTurn})`)
            .addFields(
                { name: `Team A (${matchData.teamA.length}/5)`, value: `<@${matchData.teamA.join('>, <@')}>`, inline: true },
                { name: `Team B (${matchData.teamB.length}/5)`, value: `<@${matchData.teamB.join('>, <@')}>`, inline: true },
                { name: 'Havuzdaki Oyuncular', value: matchData.availablePlayers.map(p => p.label).join(', ') || 'Kalmadı', inline: false }
            );

        // Select Menu ile oyuncu seçtirme
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`match_pick_${matchId}`)
                .setPlaceholder(`Bir oyuncu seç (${matchData.pickTurn} Takımı)`)
                .addOptions(matchData.availablePlayers.slice(0, 25)) // Max 25 limit
        );

        if (interaction.type === ComponentType.StringSelect || interaction.type === ComponentType.UserSelect) {
            await interaction.update({ content: `Match ID: ${matchId}`, embeds: [embed], components: [row] });
        } else {
            await interaction.editReply({ content: `Match ID: ${matchId}`, embeds: [embed], components: [row] });
        }
    },

    async handlePlayerPick(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const matchData = activeMatches.get(matchId);
        if (!matchData) return;

        const currentTurnCaptain = matchData.pickTurn === 'A' ? matchData.captainA : matchData.captainB;

        // Sadece sırası gelen kaptan seçebilir
        if (interaction.user.id !== currentTurnCaptain) {
            return interaction.reply({ content: '❌ Sıra sende değil!', ephemeral: true });
        }

        const pickedPlayerId = interaction.values[0];

        // Oyuncuyu takıma ekle
        if (matchData.pickTurn === 'A') {
            matchData.teamA.push(pickedPlayerId);
            matchData.pickTurn = 'B'; // Sırayı B'ye ver
        } else {
            matchData.teamB.push(pickedPlayerId);
            matchData.pickTurn = 'A'; // Sırayı A'ya ver
        }

        // Oyuncuyu havuzdan çıkar
        matchData.availablePlayers = matchData.availablePlayers.filter(p => p.value !== pickedPlayerId);

        activeMatches.set(matchId, matchData);

        // UI güncelle
        await this.updateDraftUI(interaction, matchId);
    },

    // 3. ADIM: Maç Başlatma (Ses Kanalları + Map Oylama) - Eski koddan alındı ve uyarlandı
    async startMatch(interaction, matchId) {
        const matchData = activeMatches.get(matchId);
        const guild = interaction.guild;

        const embedInit = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Takımlar Hazır!')
            .setDescription('Ses kanalları oluşturuluyor ve oyuncular taşınıyor...');

        await interaction.update({ embeds: [embedInit], components: [] });

        try {
            // Ses Kanallarını Oluştur
            const category = guild.channels.cache.get(MATCH_CATEGORY_ID);

            const createPerms = (teamIds) => [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] }))
            ];

            const voiceA = await guild.channels.create({
                name: `Team A - Match ${matchId.slice(-4)}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: createPerms(matchData.teamA)
            });

            const voiceB = await guild.channels.create({
                name: `Team B - Match ${matchId.slice(-4)}`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: createPerms(matchData.teamB)
            });

            // Oyuncuları Taşı
            const movePlayers = async (userIds, channelId) => {
                for (const userId of userIds) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && member.voice.channel) {
                        try {
                            await member.voice.setChannel(channelId);
                        } catch (e) {
                            // console.log(`Üye taşınamadı: ${member.displayName}`);
                        }
                    }
                }
            };

            await movePlayers(matchData.teamA, voiceA.id);
            await movePlayers(matchData.teamB, voiceB.id);

            // Map Oylama Kanalı
            const voteChannel = await guild.channels.create({
                name: `map-oylama-${matchId.slice(-4)}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    ...[...matchData.teamA, ...matchData.teamB].map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                ]
            });

            // Map Oylama Başlat
            const mapOptions = MAPS.map(map => ({ label: map, value: map, emoji: '🗺️' }));
            const voteRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_vote_${matchId}`)
                    .setPlaceholder('Oynamak istediğiniz haritayı seçin')
                    .addOptions(mapOptions)
            );

            const voteEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🗺️ Harita Oylaması')
                .setDescription(`Maç için harita seçimi başladı! \n\n⏳ **60 Saniye** süreniz var.`)
                .setTimestamp(Date.now() + 60000);

            const voteMsg = await voteChannel.send({
                content: [...matchData.teamA, ...matchData.teamB].map(id => `<@${id}>`).join(' '),
                embeds: [voteEmbed],
                components: [voteRow]
            });

            // Collector
            const collector = voteChannel.createMessageComponentCollector({
                filter: i => i.customId === `match_vote_${matchId}`,
                time: 60000
            });

            const votes = {};
            const votedUsers = new Set();
            const totalPlayers = matchData.teamA.length + matchData.teamB.length;

            collector.on('collect', async i => {
                if (votedUsers.has(i.user.id)) return i.reply({ content: 'Zaten oy kullandınız!', ephemeral: true });
                if (!matchData.teamA.includes(i.user.id) && !matchData.teamB.includes(i.user.id)) return i.reply({ content: 'Yetkisiz erişim.', ephemeral: true });

                const selectedMap = i.values[0];
                votes[selectedMap] = (votes[selectedMap] || 0) + 1;
                votedUsers.add(i.user.id);
                await i.reply({ content: `Oy: ${selectedMap}`, ephemeral: true });

                if (votedUsers.size === totalPlayers) collector.stop('all_voted');
            });

            collector.on('end', async () => {
                let winnerMap = MAPS[Math.floor(Math.random() * MAPS.length)];
                let maxVotes = -1;
                for (const [map, count] of Object.entries(votes)) {
                    if (count > maxVotes) { maxVotes = count; winnerMap = map; }
                    else if (count === maxVotes && Math.random() > 0.5) winnerMap = map;
                }
                const resultEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('🎮 Harita Belirlendi!').setDescription(`# 🏰 **${winnerMap}**`);
                await voteChannel.send({ embeds: [resultEmbed], components: [] });
            });

        } catch (error) {
            console.error(error);
        }
    }
};
