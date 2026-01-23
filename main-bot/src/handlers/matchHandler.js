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
        const action = parts[1]; // create, captainA, captainB, pick, start, refresh

        try {
            if (action === 'create') {
                await this.createLobby(interaction);
            } else if (action === 'captainA') {
                await this.selectCaptain(interaction, 'A');
            } else if (action === 'captainB') {
                await this.selectCaptain(interaction, 'B');
            } else if (action === 'pick') {
                await this.handlePlayerPick(interaction);
            } else if (action === 'refresh') {
                await this.refreshDraftPool(interaction);
            }
        } catch (error) {
            console.error(`Match Handler Error [${action}]:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
            } else {
                await interaction.followUp({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
            }
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
            channelId: interaction.channel.id
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
        if (!matchData) return interaction.reply({ content: 'Hata: Maç verisi yok. Lütfen paneli tekrar oluşturun.', ephemeral: true });

        const selectedId = interaction.values[0];

        if (team === 'A') {
            matchData.captainA = selectedId;
            matchData.teamA = [selectedId];
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

        if (team === 'A') embed.fields[0].value = `<@${selectedId}>`;
        else embed.fields[1].value = `<@${selectedId}>`;

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

        // Komutu kullanan adminin ses kanalını bulmaya çalışalım
        // Interaction'ı yapan kişi genelde admin olur, onun ses kanalını baz alıyoruz.
        const member = await interaction.guild.members.fetch(matchData.hostId).catch(() => null);
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.update({
                content: `❌ **Hata:** Maçı yöneten <@${matchData.hostId}> bir ses kanalında değil!\nLütfen oyuncuların olduğu ses kanalına girin ve tekrar deneyin.`,
                components: [],
                elapsed: true // Eski mesajı geçersiz kılmıyoruz ama uyarıyoruz
            });
        }

        // Kanalı taze fetch et (Cache sorunu olmasın)
        const channel = await interaction.guild.channels.fetch(voiceChannel.id);

        // Ses kanalındaki diğer oyuncuları havuza ekle (Kaptanlar, Botlar ve Admin hariç demek gerekir mi? Hayır, admin dışarıda kalsın diyebiliriz ama genelde admin oynamaz.)
        // Kaptanları zaten seçtik, onları havuzdan çıkar.
        const players = channel.members
            .filter(m => !m.user.bot && m.id !== matchData.captainA && m.id !== matchData.captainB)
            .map(m => ({ label: m.displayName.substring(0, 25), value: m.id, emoji: '👤' }));

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
            .setDescription(`**Sıra:** <@${currentTurnCaptain}> (Takım ${matchData.pickTurn}) tarafından seçim yapılıyor.\n\nKaptanlar aşağıdaki menüden sırası gelince oyuncu seçmelidir.`)
            .addFields(
                { name: `🔷 Team A (${matchData.teamA.length}/5)`, value: matchData.teamA.map(id => `<@${id}>`).join('\n') || 'Boş', inline: true },
                { name: `🔶 Team B (${matchData.teamB.length}/5)`, value: matchData.teamB.map(id => `<@${id}>`).join('\n') || 'Boş', inline: true },
                { name: '📍 Havuzdaki Oyuncular', value: matchData.availablePlayers.map(p => p.label).join(', ') || '*Kimse kalmadı*', inline: false }
            );

        const components = [];

        // Select Menu (Oyuncular varsa)
        if (matchData.availablePlayers.length > 0) {
            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`match_pick_${matchId}`)
                        .setPlaceholder(`Bir oyuncu seç (Takım ${matchData.pickTurn})`)
                        .addOptions(matchData.availablePlayers.slice(0, 25))
                )
            );
        } else {
            embed.setDescription('⚠️ Havuzda oyuncu kalmadı! Oyuncular ses kanalına girsin ve **Listeyi Yenile** butonuna basın.');
        }

        // Refresh butonu ekle
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`match_refresh_${matchId}`)
                    .setLabel('🔄 Listeyi Yenile')
                    .setStyle(ButtonStyle.Secondary),
                // (Tester için) Force Start Butonu
                // new ButtonBuilder().setCustomId(`match_forcestart_${matchId}`).setLabel('Zorla Başlat').setStyle(ButtonStyle.Danger) 
            )
        );

        if (interaction.isMessageComponent()) {
            await interaction.update({ content: `Match ID: ${matchId}`, embeds: [embed], components: components });
        } else {
            // createLobby'den geliyorsa message.edit olmaz, reply olabilir veya update olabilir duruma göre.
            // startDraftMode -> updateDraftUI akışında ilk çağrı update olmalı.
            // Ancak selectCaptain bir update interaction'dı. O yüzden update valid.
            await interaction.update({ content: `Match ID: ${matchId}`, embeds: [embed], components: components });
        }
    },

    async refreshDraftPool(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const matchData = activeMatches.get(matchId);
        if (!matchData) return;

        // Admin ses kanalını tekrar kontrol et
        const member = await interaction.guild.members.fetch(matchData.hostId).catch(() => null);
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Admin ses kanalında değil!', ephemeral: true });
        }

        const channel = await interaction.guild.channels.fetch(voiceChannel.id);
        const players = channel.members
            .filter(m => !m.user.bot && m.id !== matchData.captainA && m.id !== matchData.captainB && !matchData.teamA.includes(m.id) && !matchData.teamB.includes(m.id))
            .map(m => ({ label: m.displayName.substring(0, 25), value: m.id, emoji: '👤' }));

        matchData.availablePlayers = players;
        activeMatches.set(matchId, matchData);

        // UI güncelle
        await this.updateDraftUI(interaction, matchId);
    },

    async handlePlayerPick(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const matchData = activeMatches.get(matchId);
        if (!matchData) return interaction.reply({ content: 'Maç bulunamadı.', ephemeral: true });

        const currentTurnCaptain = matchData.pickTurn === 'A' ? matchData.captainA : matchData.captainB;

        // Sadece sırası gelen kaptan seçebilir
        if (interaction.user.id !== currentTurnCaptain) {
            return interaction.reply({ content: `❌ Sıra sende değil! Şu an <@${currentTurnCaptain}> seçiyor.`, ephemeral: true });
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

    // 3. ADIM: Maç Başlatma
    async startMatch(interaction, matchId) {
        const matchData = activeMatches.get(matchId);
        const guild = interaction.guild;

        const embedInit = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🚀 Maç Başlatılıyor!')
            .setDescription('✅ Takımlar belirlendi.\n\n🔊 Ses kanalları oluşturuluyor...\n➡️ Oyuncular taşınıyor...\n🗳️ Harita oylaması hazırlanıyor...')
            .addFields(
                { name: 'Team A', value: matchData.teamA.map(id => `<@${id}>`).join(', '), inline: false },
                { name: 'Team B', value: matchData.teamB.map(id => `<@${id}>`).join(', '), inline: false }
            );

        await interaction.update({ embeds: [embedInit], components: [] });

        try {
            // Ses Kanalları
            const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
            // Kategori yoksa hata verebilir, kontrol ekle
            if (!category) {
                return interaction.followUp({ content: '❌ Hata: Maç kategorisi (MATCH_CATEGORY_ID) sunucuda bulunamadı!', ephemeral: true });
            }

            const createPerms = (teamIds) => [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))
            ];

            const voiceA = await guild.channels.create({
                name: `🔷 Team A`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: createPerms(matchData.teamA)
            });

            const voiceB = await guild.channels.create({
                name: `🔶 Team B`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: createPerms(matchData.teamB)
            });

            // Taşıma İşlemi (Promise.all ile hızlandır)
            const moveMember = async (id, channelId) => {
                try {
                    const member = await guild.members.fetch(id);
                    if (member.voice.channel) await member.voice.setChannel(channelId);
                } catch (e) { console.log(`Taşıma hatası (${id}):`, e.message); }
            };

            await Promise.all([
                ...matchData.teamA.map(id => moveMember(id, voiceA.id)),
                ...matchData.teamB.map(id => moveMember(id, voiceB.id))
            ]);

            // Map Oylama Kanalı
            const voteChannel = await guild.channels.create({
                name: `🗳️・map-voting`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    ...[...matchData.teamA, ...matchData.teamB].map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }))
                ]
            });

            // Oylama Mesajı
            const mapOptions = MAPS.map(map => ({ label: map, value: map, emoji: '🗺️' }));
            const voteRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_vote_${matchId}`)
                    .setPlaceholder('Harita seçiniz...')
                    .addOptions(mapOptions)
            );

            const voteEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🗺️ Harita Oylaması Başladı')
                .setDescription(`Aşağıdaki menüden oynamak istediğiniz haritayı seçin.\n\n⏱️ **Süre:** 60 Saniye`)
                .setTimestamp(Date.now() + 60000);

            const voteMsg = await voteChannel.send({
                content: [...matchData.teamA, ...matchData.teamB].map(id => `<@${id}>`).join(' '),
                embeds: [voteEmbed],
                components: [voteRow]
            });

            // Collector Mantığı...
            const collector = voteChannel.createMessageComponentCollector({
                filter: i => i.customId === `match_vote_${matchId}`,
                time: 60000
            });

            const votes = {};
            const votedUsers = new Set();
            const totalPlayers = matchData.teamA.length + matchData.teamB.length;

            collector.on('collect', async i => {
                if (votedUsers.has(i.user.id)) return i.reply({ content: 'Zaten oy verdiniz!', ephemeral: true });
                if (!matchData.teamA.includes(i.user.id) && !matchData.teamB.includes(i.user.id)) return i.reply({ content: 'Maçta değilsiniz.', ephemeral: true });

                const map = i.values[0];
                votes[map] = (votes[map] || 0) + 1;
                votedUsers.add(i.user.id);

                await i.reply({ content: `✅ Oyunuz alındı: **${map}**`, ephemeral: true });

                if (votedUsers.size === totalPlayers) collector.stop();
            });

            collector.on('end', async () => {
                let winner = MAPS[Math.floor(Math.random() * MAPS.length)];
                let max = -1;
                for (const [m, c] of Object.entries(votes)) {
                    if (c > max) { max = c; winner = m; }
                }

                const resEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('🏰 Harita Seçildi!').setDescription(`# **${winner}**`).setFooter({ text: 'İyi oyunlar!' });
                await voteChannel.send({ embeds: [resEmbed], components: [] });

                // 2 dakika sonra kanalı silme opsiyonu eklenebilir
                // setTimeout(() => voteChannel.delete(), 120000);
            });

        } catch (error) {
            console.error('Start match error:', error);
            interaction.followUp({ content: '❌ Sistem kurulurken kritik bir hata oluştu.', ephemeral: true });
        }
    }
};
