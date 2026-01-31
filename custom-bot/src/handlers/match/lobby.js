const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const draftHandler = require('./draft');
const { getCategoryId, setCategoryId } = require('./constants');

module.exports = {
    async createLobby(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        const REQUIRED_VOICE_ID = '1463922466467483801';
        const { MessageFlags, PermissionsBitField } = require('discord.js');

        // Yetki ve Kanal Kontrolü
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.member.voice.channelId !== REQUIRED_VOICE_ID) {
            return interaction.reply({ content: `❌ Maç oluşturmak için <#${REQUIRED_VOICE_ID}> kanalında olmalısınız!`, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const guild = interaction.guild;
            const matchShortId = interaction.id.slice(-4);

            // 1. Kategori Kontrol (veya oluştur)
            let MATCH_CATEGORY_ID = getCategoryId();
            let category = guild.channels.cache.get(MATCH_CATEGORY_ID);
            if (!category) {
                category = await guild.channels.create({ name: '🏆 | ACTIVE MATCHES', type: ChannelType.GuildCategory });
                MATCH_CATEGORY_ID = category.id;
                setCategoryId(MATCH_CATEGORY_ID);
            }

            // 2. Özel Kanalları Oluştur (Dinamik Lobi - Sadece Yazı)
            // Herkesin görebileceği ama sadece yetkililerin yönetebileceği izinler
            const everyone = guild.roles.everyone;

            const textChannel = await guild.channels.create({
                name: `match-${matchShortId}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: everyone.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }, // Herkes görebilir
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.SendMessages] } // Host yazabilir
                ]
            });

            // 3. Veritabanı Kayıt
            // lobbyVoiceId: Kullanıcıların maç bitince döneceği yer (şu an bulundukları Main Lobby)
            const newMatch = new Match({
                matchId: interaction.id,
                guildId: guild.id,
                hostId: interaction.user.id,
                channelId: textChannel.id, // İşlemler yeni kanalda dönecek
                lobbyVoiceId: REQUIRED_VOICE_ID, // Maç bitince buraya (Main Lobiye) postala
                createdChannelIds: [textChannel.id], // Silinecekler listesi (Sadece Yazı)
                status: 'SETUP'
            });
            await newMatch.save();

            // 5. Paneli Yeni Kanala Gönder
            const embed = new EmbedBuilder().setColor(0x5865F2)
                .setTitle(`👑 Match #${matchShortId} | Kaptan Seçimi`)
                .setDescription(`**Lobi Hazır!**\nKaptanları belirleyin ve takımları kurmaya başlayın.\n\nEv Sahibi: <@${interaction.user.id}>`)
                .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true })
                .setFooter({ text: 'Made by Swaff' });

            // 4. Ses Kanalındaki Üyeleri Getir (Filtreleme için)
            const voiceChannel = guild.channels.cache.get(REQUIRED_VOICE_ID);
            const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

            console.log(`[Lobby Debug] Kanal ID: ${REQUIRED_VOICE_ID}`);
            console.log(`[Lobby Debug] Kanalda Bulunanlar: ${voiceMembers.map(m => m.user.username).join(', ')}`);

            // Eğer kanalda kimse yoksa
            if (voiceMembers.size === 0) {
                return interaction.editReply({ content: '❌ Lobi kanalında kimse bulunamadı! Lütfen ses kanalına girin.' });
            }

            // Seçenekleri Hazırla (Max 25 kişi)
            const memberOptions = voiceMembers.map(m => ({
                label: m.displayName,
                description: m.user.tag,
                value: m.id,
                emoji: '👤'
            })).slice(0, 25);

            if (memberOptions.length === 0) memberOptions.push({ label: 'Hata', value: 'null', description: 'Kimse bulunamadı' });

            // ID'leri değiştirdim ki cache sorunu varsa çözülsün: match_captainA -> match_cap_select_A
            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('match_cap_select_A')
                        .setPlaceholder('Team A Kaptanı Seç (Ses Kanalından)')
                        .addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('match_cap_select_B')
                        .setPlaceholder('Team B Kaptanı Seç (Ses Kanalından)')
                        .addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`match_randomcap_${interaction.id}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`match_cancel_${interaction.id}`).setLabel('Maçı İptal Et').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                )
            ];

            await textChannel.send({ content: `Match ID: ${interaction.id}\n<@${interaction.user.id}> maç oluşturuldu!`, embeds: [embed], components: rows });

            await interaction.editReply({ content: `✅ Maç oluşturuldu! Lütfen panele gidin:\nKanal: <#${textChannel.id}>` });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Maç oluşturulurken hata çıktı.' });
        }
    },

    async cancelMatch(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        // Admin yetkisi veya özel rol kontrolü
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu işlemi sadece yetkililer yapabilir.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        // Onay mesajı gönderip silebiliriz veya direkt silebiliriz. Hızlı olması için direkt siliyoruz.
        try {
            if (match) {
                // Kanalları sil
                if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                    for (const cId of match.createdChannelIds) {
                        await interaction.guild.channels.delete(cId).catch(() => console.log('Kanal zaten silinmiş'));
                    }
                }
                // DB'den sil
                await Match.deleteOne({ matchId });
            } else {
                // Match yoksa bile kanalı sil (Artık kanalın içinden basıldıysa)
                await interaction.channel.delete().catch(() => { });
            }
        } catch (error) {
            console.error('Cancel Match Error:', error);
            await interaction.reply({ content: '❌ Silme işlemi sırasında hata.', flags: require('discord.js').MessageFlags.Ephemeral });
        }
    },

    async selectCaptain(interaction, team) {
        const { MessageFlags } = require('discord.js');

        // Match ID'yi güvenli şekilde çıkar (satır sonu veya boşluk varsa temizle)
        const content = interaction.message.content || '';
        const matchLine = content.split('\n')[0]; // İlk satırı al
        const matchId = matchLine.replace('Match ID: ', '').trim();

        if (!matchId) return interaction.reply({ content: 'Match ID bulunamadı.', flags: MessageFlags.Ephemeral });

        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: MessageFlags.Ephemeral });

        const selectedId = interaction.values[0];
        if (team === 'A') {
            if (match.captainB === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', flags: MessageFlags.Ephemeral });
            match.captainA = selectedId; match.teamA = [selectedId];
        } else {
            if (match.captainA === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', flags: MessageFlags.Ephemeral });
            match.captainB = selectedId; match.teamB = [selectedId];
        }
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async assignRandomCaptains(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: MessageFlags.Ephemeral });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: 'Ses kanalında değilsin!', flags: MessageFlags.Ephemeral });

        const members = voiceChannel.members.filter(m => !m.user.bot).map(m => m.id);
        if (members.length < 2) return interaction.reply({ content: 'En az 2 oyuncu lazım.', flags: MessageFlags.Ephemeral });

        const shuffled = members.sort(() => 0.5 - Math.random());
        match.captainA = shuffled[0]; match.teamA = [shuffled[0]];
        match.captainB = shuffled[1]; match.teamB = [shuffled[1]];
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async updateCaptainUI(interaction, match) {
        // Embed kontrolü
        if (!interaction.message.embeds || interaction.message.embeds.length === 0) {
            return interaction.reply({ content: '❌ Panel bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(0, 2,
            { name: '🔵 Team A Kaptanı', value: match.captainA ? `<@${match.captainA}>` : 'Seçilmedi', inline: true },
            { name: '🔴 Team B Kaptanı', value: match.captainB ? `<@${match.captainB}>` : 'Seçilmedi', inline: true }
        );

        if (match.captainA && match.captainB) {
            match.status = 'DRAFT';
            await match.save();
            await interaction.message.delete().catch(() => { });

            // Draft Modülüne Geç
            await draftHandler.startDraftMode(interaction, match);
        } else {
            // MENÜLERİ GÜNCELLE (Seçilenleri çıkar)
            const REQUIRED_VOICE_ID = '1463922466467483801';
            const voiceChannel = interaction.guild.channels.cache.get(REQUIRED_VOICE_ID);
            const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

            // Tüm uygun adaylar
            let candidates = voiceMembers.map(m => ({
                label: m.displayName,
                description: m.user.tag,
                value: m.id,
                emoji: '👤'
            }));

            if (candidates.length === 0) candidates.push({ label: 'Hata', value: 'null', description: 'Kimse bulunamadı' });

            // Team A için Menü: (Eğer Team A zaten seçildiyse disabled yap, değilse Team B kaptanını listeden çıkar)
            const optionsA = candidates.filter(c => c.value !== match.captainB);
            const selectA = new StringSelectMenuBuilder()
                .setCustomId('match_cap_select_A')
                .setPlaceholder(match.captainA ? '✅ Seçildi' : 'Team A Kaptanı Seç')
                .setDisabled(!!match.captainA) // Varsa disable et
                .addOptions(optionsA.length > 0 ? optionsA.slice(0, 25) : [{ label: 'Uygun Aday Yok', value: 'null' }]);

            // Team B için Menü: (Eğer Team B zaten seçildiyse disabled yap, değilse Team A kaptanını listeden çıkar)
            const optionsB = candidates.filter(c => c.value !== match.captainA);
            const selectB = new StringSelectMenuBuilder()
                .setCustomId('match_cap_select_B')
                .setPlaceholder(match.captainB ? '✅ Seçildi' : 'Team B Kaptanı Seç')
                .setDisabled(!!match.captainB) // Varsa disable et
                .addOptions(optionsB.length > 0 ? optionsB.slice(0, 25) : [{ label: 'Uygun Aday Yok', value: 'null' }]);

            const rows = [
                new ActionRowBuilder().addComponents(selectA),
                new ActionRowBuilder().addComponents(selectB),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`match_randomcap_${interaction.message.id.replace(/\D/g, '')}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('Maçı İptal Et').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                )
            ];

            await interaction.update({ embeds: [embed], components: rows });
        }
    },

    async resetLobby(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        // İşlem uzun sürebilir (taşıma vs.), o yüzden önce Discord'a 'Bekle' diyoruz.
        await interaction.deferUpdate();

        // 1. ÖNCE: Oyuncuları Lobiye Taşı
        const guild = interaction.guild;
        if (match.lobbyVoiceId) {
            const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];
            const move = async (pid) => {
                try {
                    const member = await guild.members.fetch(pid).catch(() => null);
                    if (member && member.voice.channel) await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                } catch (e) { }
            };
            await Promise.all(allPlayers.map(pid => move(pid)));
        }

        // 2. SONRA: Ses Kanallarını Sil
        const manager = require('./manager');
        await manager.cleanupVoiceChannels(guild, match);

        // 2. Verileri Sıfırla
        match.captainA = null;
        match.captainB = null;
        match.teamA = [];
        match.teamB = [];
        match.status = 'SETUP';
        match.createdChannelIds = match.createdChannelIds.filter(id => id === match.channelId); // Sadece yazı kanalını tut
        await match.save();

        // 3. UI'ı Yeniden Başlat (CreateLobby mantığının aynısı ama update ile)
        const REQUIRED_VOICE_ID = '1463922466467483801';
        const voiceChannel = interaction.guild.channels.cache.get(REQUIRED_VOICE_ID);
        const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

        const memberOptions = voiceMembers.map(m => ({
            label: m.displayName,
            description: m.user.tag,
            value: m.id,
            emoji: '👤'
        })).slice(0, 25);

        if (memberOptions.length === 0) memberOptions.push({ label: 'Hata', value: 'null', description: 'Odada kimse yok' });

        const embed = new EmbedBuilder().setColor(0x5865F2)
            .setTitle(`👑 Match #${match.matchId.slice(-4)} | Kaptan Seçimi (Sıfırlandı)`)
            .setDescription(`**Lobi Sıfırlandı!**\nKaptanları yeniden belirleyin.\n\nEv Sahibi: <@${match.hostId}>`)
            .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true })
            .setFooter({ text: 'Made by Swaff' });

        const rows = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('match_cap_select_A').setPlaceholder('Team A Kaptanı Seç').addOptions(memberOptions)
            ),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('match_cap_select_B').setPlaceholder('Team B Kaptanı Seç').addOptions(memberOptions)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_randomcap_${match.matchId}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('Maçı İptal Et').setEmoji('🛑').setStyle(ButtonStyle.Danger)
            )
        ];

        await interaction.editReply({ content: null, embeds: [embed], components: rows });
    }
};
