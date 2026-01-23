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

const MATCH_CATEGORY_ID = '1463883244436197397'; // Map oylama ve maç odaları kategorisi

// Maç durumlarını bellekte tutmak için basit bir store (Prod ortamda Redis/DB önerilir)
const activeMatches = new Map();

module.exports = {
    async handleInteraction(interaction, client) {
        const { customId, guild, user, member } = interaction;
        const [prefix, action] = customId.split('_'); // match_create -> prefix=match, action=create

        if (action === 'create') {
            await this.createLobby(interaction);
        } else if (action === 'teamA' || action === 'teamB') {
            // User select menu handler
            await this.handleTeamSelection(interaction);
        } else if (action === 'start') {
            await this.startMatchProcess(interaction);
        } else if (action === 'vote') {
            await this.handleMapVote(interaction);
        }
    },

    async createLobby(interaction) {
        // Maçı oluşturan (Kaptan/Admin)
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🏟️ Maç Lobisi Oluşturuluyor')
            .setDescription('Lütfen Takım A ve Takım B oyuncularını seçin.')
            .addFields(
                { name: 'Takım A', value: 'Henüz seçilmedi', inline: true },
                { name: 'Takım B', value: 'Henüz seçilmedi', inline: true }
            );

        const row1 = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('match_teamA')
                .setPlaceholder('Takım A Oyuncularını Seç (Max 5)')
                .setMinValues(1)
                .setMaxValues(5)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('match_teamB')
                .setPlaceholder('Takım B Oyuncularını Seç (Max 5)')
                .setMinValues(1)
                .setMaxValues(5)
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('match_start')
                .setLabel('Maçı Başlat ve Map Oylamaya Geç')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true) // Oyuncular seçilene kadar kapalı
        );

        // Geçici bir ID ile eşleşmeyi kaydet
        const matchId = interaction.id;
        activeMatches.set(matchId, {
            teamA: [],
            teamB: [],
            hostId: interaction.user.id,
            embedMessageId: null,
            channelId: interaction.channel.id
        });

        const reply = await interaction.reply({
            content: `Maç ID: ${matchId}`,
            embeds: [embed],
            components: [row1, row2, row3],
            ephemeral: true,
            fetchReply: true
        });

        // Mesaj ID'sini güncelle
        const matchData = activeMatches.get(matchId);
        matchData.embedMessageId = reply.id;
        activeMatches.set(matchId, matchData);
    },

    async handleTeamSelection(interaction) {
        // match_teamA veya match_teamB
        const matchId = interaction.message.content.split('Maç ID: ')[1];
        const matchData = activeMatches.get(matchId);

        if (!matchData) return interaction.reply({ content: 'Maç verisi bulunamadı!', ephemeral: true });

        const selectedUserIds = interaction.values;
        const teamSide = interaction.customId.split('_')[1]; // teamA veya teamB

        if (teamSide === 'teamA') matchData.teamA = selectedUserIds;
        else matchData.teamB = selectedUserIds;

        activeMatches.set(matchId, matchData);

        // Embed güncelle
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const teamAField = embed.data.fields[0];
        const teamBField = embed.data.fields[1];

        // İsimleri listele
        const getNames = async (ids) => {
            if (ids.length === 0) return 'Henüz seçilmedi';
            const names = [];
            for (const id of ids) {
                const user = await interaction.guild.members.fetch(id).catch(() => null);
                names.push(user ? user.displayName : id);
            }
            return names.join('\n');
        };

        if (teamSide === 'teamA') teamAField.value = await getNames(matchData.teamA);
        else teamBField.value = await getNames(matchData.teamB);

        // Başlat butonunu kontrol et
        const components = interaction.message.components.map(c => ActionRowBuilder.from(c));
        const startButton = components[2].components[0];

        // Basit kontrol: Her takımda en az 1 kişi varsa başlatılabilir (Tester için, prod'da 5 olabilir)
        if (matchData.teamA.length > 0 && matchData.teamB.length > 0) {
            startButton.setDisabled(false);
        } else {
            startButton.setDisabled(true);
        }

        await interaction.update({ embeds: [embed], components: components });
    },

    async startMatchProcess(interaction) {
        const matchId = interaction.message.content.split('Maç ID: ')[1];
        const matchData = activeMatches.get(matchId);
        const guild = interaction.guild;

        if (!matchData) return;

        await interaction.update({ content: '⏳ Sistem kuruluyor... Ses kanalları açılıyor ve oyuncular taşınıyor.', components: [] });

        try {
            // 1. Ses Kanallarını Oluştur
            const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
            if (!category) throw new Error('Maç kategorisi bulunamadı!');

            // İzinler: Sadece takım üyeleri görebilir/bağlanabilir
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

            // 2. Oyuncuları Taşı
            const movePlayers = async (userIds, channelId) => {
                for (const userId of userIds) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && member.voice.channel) {
                        try {
                            await member.voice.setChannel(channelId);
                        } catch (e) {
                            console.log(`Üye taşınamadı: ${member.displayName}`);
                        }
                    }
                }
            };

            await movePlayers(matchData.teamA, voiceA.id);
            await movePlayers(matchData.teamB, voiceB.id);

            // 3. Map Oylama Kanalı Oluştur
            const voteChannel = await guild.channels.create({
                name: `map-oylama-${matchId.slice(-4)}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    ...[...matchData.teamA, ...matchData.teamB].map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
                ]
            });

            matchData.voteChannelId = voteChannel.id;
            matchData.voiceAId = voiceA.id;
            matchData.voiceBId = voiceB.id;
            activeMatches.set(matchId, matchData);

            // 4. Map Oylama Mesajı
            // Haritaları seçenek olarak ekle
            const mapOptions = MAPS.map(map => ({
                label: map,
                value: map,
                emoji: '🗺️'
            }));

            // Select menu limitasyonundan dolayı (max 25), haritalar sığıyor (10 map).
            const voteRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_vote_${matchId}`) // match_vote_MATCHID
                    .setPlaceholder('Oynamak istediğiniz haritayı seçin')
                    .addOptions(mapOptions)
            );

            const voteEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🗺️ Harita Oylaması')
                .setDescription(`Maç için harita seçimi başladı! \n\n⏳ **60 Saniye** süreniz var.\n\nSadece maçtaki oyuncular oy kullanabilir.`)
                .addFields({ name: 'Durum', value: 'Oylama bekleniyor...' })
                .setTimestamp(Date.now() + 60000);

            const voteMsg = await voteChannel.send({
                content: [...matchData.teamA, ...matchData.teamB].map(id => `<@${id}>`).join(' '),
                embeds: [voteEmbed],
                components: [voteRow]
            });

            // Oylama Takibi
            const filter = i => i.customId === `match_vote_${matchId}`;
            const collector = voteChannel.createMessageComponentCollector({
                filter,
                time: 60000
            });

            const votes = {}; // { 'Ascent': 3, 'Bind': 1 }
            const votedUsers = new Set();
            const totalPlayers = matchData.teamA.length + matchData.teamB.length;

            collector.on('collect', async i => {
                if (votedUsers.has(i.user.id)) {
                    return i.reply({ content: 'Zaten oy kullandınız!', ephemeral: true });
                }

                if (!matchData.teamA.includes(i.user.id) && !matchData.teamB.includes(i.user.id)) {
                    return i.reply({ content: 'Sadece maçtaki oyuncular oy kullanabilir.', ephemeral: true });
                }

                const selectedMap = i.values[0];
                votes[selectedMap] = (votes[selectedMap] || 0) + 1;
                votedUsers.add(i.user.id);

                await i.reply({ content: `Oy verdiniz: **${selectedMap}**`, ephemeral: true });

                // Embed güncelle (Kim kaç oy verdi göstermeden sadece toplamı gösterelim veya gizli kalsın)
                // Şimdilik sadece katılım sayısını gösterelim
                const currentEmbed = EmbedBuilder.from(voteMsg.embeds[0]);
                currentEmbed.fields[0].value = `${votedUsers.size}/${totalPlayers} kişi oy kullandı.`;
                await voteMsg.edit({ embeds: [currentEmbed] });

                if (votedUsers.size === totalPlayers) {
                    collector.stop('all_voted');
                }
            });

            collector.on('end', async () => {
                // Kazanan map'i belirle
                let winnerMap = MAPS[Math.floor(Math.random() * MAPS.length)]; // Default random
                let maxVotes = -1;

                for (const [map, count] of Object.entries(votes)) {
                    if (count > maxVotes) {
                        maxVotes = count;
                        winnerMap = map;
                    } else if (count === maxVotes) {
                        // Eşitlik durumunda random seçim (veya ilk olan)
                        if (Math.random() > 0.5) winnerMap = map;
                    }
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎮 Harita Belirlendi!')
                    .setDescription(`Oylama sonucu seçilen harita:\n# 🏰 **${winnerMap}**`)
                    .setFooter({ text: 'İyi oyunlar! Maç başladı.' });

                await voteChannel.send({ embeds: [resultEmbed], components: [] });

                // Oylama kanalını temizle (Sadece info kalsın) veya maçı yönet
                // 10 saniye sonra kanalı silme veya maç sonuna kadar tutma opsiyonu
                // User isteği: Map oylama kanalı açılır, oylanır. Sonrası belirtilmedi ama kanal kalabilir chat için.
            });

            await interaction.followUp({ content: `✅ Kurulum tamamlandı! Oylama kanalı: <#${voteChannel.id}>`, ephemeral: true });

        } catch (error) {
            console.error('Maç başlatma hatası:', error);
            await interaction.followUp({ content: '❌ Maç başlatılırken bir hata oluştu.', ephemeral: true });
        }
    },

    async handleMapVote(interaction) {
        // Bu fonksiyon collector içinde handle edildiği için boş bırakıldı veya harici mantık eklenebilir.
    }
};
