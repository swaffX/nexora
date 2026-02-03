const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const draftHandler = require('./draft');
const { getLobbyConfig, BLOCKED_ROLE_ID } = require('./constants');

module.exports = {
    async createLobby(interaction, targetLobbyId) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        const { MessageFlags, PermissionsBitField } = require('discord.js');

        // Yetki Kontrolü
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }

        // Lobi Configini Al
        const lobbyConfig = getLobbyConfig(targetLobbyId);
        if (!lobbyConfig) {
            return interaction.reply({ content: '❌ Geçersiz Lobi ID veya konfigürasyon bulunamadı.', flags: MessageFlags.Ephemeral });
        }

        const REQUIRED_VOICE_ID = lobbyConfig.voiceId;
        const MATCH_CATEGORY_ID = lobbyConfig.categoryId;

        // Admin ses kanalında mı? (Opsiyonel: Eğer maç kuran kişi seste değilse bile kurabilsin denebilir ama güvenlik için kalsın)
        if (interaction.member.voice.channelId !== REQUIRED_VOICE_ID) {
            return interaction.reply({ content: `❌ Bu lobi için maç oluşturmak adına **<#${REQUIRED_VOICE_ID}>** ses kanalında olmalısınız!`, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const guild = interaction.guild;

            // Sıralı Maç Numarasını Bul
            const lastMatch = await Match.findOne({ guildId: guild.id }).sort({ matchNumber: -1 });
            const currentMatchNumber = (lastMatch && lastMatch.matchNumber) ? lastMatch.matchNumber + 1 : 1;

            // Kategori Kontrol
            let category = guild.channels.cache.get(MATCH_CATEGORY_ID);
            if (!category) {
                // Eğer kategori yoksa oluştur ama ID'yi güncellemek gerekir (constants dosyasında static değil artık)
                // Bu durumda hata vermek daha güvenli, çünkü sen ID'leri elle verdin.
                return interaction.editReply({ content: `❌ Kategori bulunamadı! (ID: ${MATCH_CATEGORY_ID})` });
            }

            // Ses Kanalındaki Üyeleri Getir (İzinler için)
            const voiceChannel = guild.channels.cache.get(REQUIRED_VOICE_ID);
            const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

            // İzinleri Hazırla
            const permissionOverwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Herkese yasak
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }, // Kurucu Sadece Okur
                { id: BLOCKED_ROLE_ID, deny: [PermissionsBitField.Flags.ViewChannel] } // Yasaklı Role Yasak (Garanti)
            ];

            // Sesteki üyelere izin ver
            voiceMembers.forEach(member => {
                permissionOverwrites.push({
                    id: member.id,
                    allow: [PermissionsBitField.Flags.ViewChannel]
                });
            });

            // Metin Kanalını Oluştur
            const textChannel = await guild.channels.create({
                name: `match-${currentMatchNumber}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: permissionOverwrites
            });

            // Veritabanı Kayıt
            const newMatch = new Match({
                matchId: interaction.id,
                guildId: guild.id,
                matchNumber: currentMatchNumber,
                hostId: interaction.user.id,
                channelId: textChannel.id,
                lobbyVoiceId: REQUIRED_VOICE_ID, // Kritik: Maçın bağlı olduğu lobi
                createdChannelIds: [textChannel.id],
                status: 'SETUP'
            });
            await newMatch.save();

            // Panel Tasarımı
            const embed = new EmbedBuilder().setColor(0x5865F2)
                .setTitle(`🛡️ LOBİ YÖNETİMİ (${lobbyConfig.name})`)
                .setDescription(`**Lobi Hazır!**\nKaptanları belirleyip takımları kurmaya başlayın.\n\n👑 **Yetkili:** <@${interaction.user.id}>`)
                .addFields(
                    { name: '🔵 Team A', value: 'Wait...', inline: true },
                    { name: '🔴 Team B', value: 'Wait...', inline: true }
                )
                .setFooter({ text: `Nexora Competitive • Match #${currentMatchNumber}` });

            // Kaptan Adayları
            const memberOptions = voiceMembers.map(m => ({
                label: m.displayName,
                description: m.user.tag,
                value: m.id,
                emoji: '👤'
            })).slice(0, 25);

            if (memberOptions.length === 0) memberOptions.push({ label: 'Hata', value: 'null', description: 'Kimse bulunamadı' });

            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`match_cap_select_A_${interaction.id}`).setPlaceholder('Team A Kaptanı Seç').addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`match_cap_select_B_${interaction.id}`).setPlaceholder('Team B Kaptanı Seç').addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`match_randomcap_${interaction.id}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`match_cancel_${interaction.id}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                )
            ];

            await textChannel.send({ embeds: [embed], components: rows });
            await interaction.editReply({ content: `✅ **${lobbyConfig.name}** Maçı oluşturuldu! <#${textChannel.id}>` });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Maç oluşturulurken hata çıktı.' });
        }
    },

    async cancelMatch(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu işlemi sadece yetkililer yapabilir.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        try {
            if (match) {
                if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                    for (const cId of match.createdChannelIds) {
                        await interaction.guild.channels.delete(cId).catch(() => console.log('Kanal zaten silinmiş'));
                    }
                }
                await Match.deleteOne({ matchId });
            } else {
                await interaction.channel.delete().catch(() => { });
            }
        } catch (error) {
            console.error('Cancel Match Error:', error);
            await interaction.reply({ content: '❌ Silme işlemi sırasında hata.', flags: require('discord.js').MessageFlags.Ephemeral });
        }
    },

    async selectCaptain(interaction, team, matchIdFromCustomId) {
        const { MessageFlags } = require('discord.js');

        if (!matchIdFromCustomId) return interaction.reply({ content: 'Match ID bulunamadı.', flags: MessageFlags.Ephemeral });

        const match = await Match.findOne({ matchId: matchIdFromCustomId });
        if (!match) return interaction.reply({ content: 'Maç verisi bulunamadı.', flags: MessageFlags.Ephemeral });

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

        // DİKKAT: Artık interaction.member.voice.channel yerine Lobi Ses Kanalını kullanmalıyız
        // Çünkü rastgele butona basan kişi seste olmak zorunda değil, ama oyuncular lobi ses kanalında
        const voiceChannel = interaction.guild.channels.cache.get(match.lobbyVoiceId);
        if (!voiceChannel) return interaction.reply({ content: 'Lobi ses kanalı bulunamadı!', flags: MessageFlags.Ephemeral });

        const members = voiceChannel.members.filter(m => !m.user.bot).map(m => m.id);
        if (members.length < 2) return interaction.reply({ content: 'Ses kanalında en az 2 oyuncu olmalı.', flags: MessageFlags.Ephemeral });

        const shuffled = members.sort(() => 0.5 - Math.random());
        match.captainA = shuffled[0]; match.teamA = [shuffled[0]];
        match.captainB = shuffled[1]; match.teamB = [shuffled[1]];
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async updateCaptainUI(interaction, match) {
        if (!interaction.message.embeds || interaction.message.embeds.length === 0) {
            return interaction.reply({ content: '❌ Panel bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(0, 2,
            { name: '🔵 Team A', value: match.captainA ? `<@${match.captainA}>` : 'Seçilmedi', inline: true },
            { name: '🔴 Team B', value: match.captainB ? `<@${match.captainB}>` : 'Seçilmedi', inline: true }
        );

        if (match.captainA && match.captainB) {
            match.status = 'DRAFT';
            await match.save();
            await interaction.message.delete().catch(() => { });
            await draftHandler.startDraftMode(interaction, match);
        } else {
            // MENÜLERİ YENİLE (Dinamik Lobi ID ile)
            const voiceChannel = interaction.guild.channels.cache.get(match.lobbyVoiceId);
            const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

            let candidates = voiceMembers.map(m => ({
                label: m.displayName,
                description: m.user.tag,
                value: m.id,
                emoji: '👤'
            }));

            if (candidates.length === 0) candidates.push({ label: 'Hata', value: 'null', description: 'Kimse bulunamadı' });

            const optionsA = candidates.filter(c => c.value !== match.captainB);
            const selectA = new StringSelectMenuBuilder()
                .setCustomId(`match_cap_select_A_${match.matchId}`)
                .setPlaceholder(match.captainA ? '✅ Seçildi' : 'Team A Kaptanı Seç')
                .setDisabled(!!match.captainA)
                .addOptions(optionsA.length > 0 ? optionsA.slice(0, 25) : [{ label: 'Uygun Aday Yok', value: 'null' }]);

            const optionsB = candidates.filter(c => c.value !== match.captainA);
            const selectB = new StringSelectMenuBuilder()
                .setCustomId(`match_cap_select_B_${match.matchId}`)
                .setPlaceholder(match.captainB ? '✅ Seçildi' : 'Team B Kaptanı Seç')
                .setDisabled(!!match.captainB)
                .addOptions(optionsB.length > 0 ? optionsB.slice(0, 25) : [{ label: 'Uygun Aday Yok', value: 'null' }]);

            const rows = [
                new ActionRowBuilder().addComponents(selectA),
                new ActionRowBuilder().addComponents(selectB),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`match_randomcap_${match.matchId}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                )
            ];

            try {
                await interaction.update({ embeds: [embed], components: rows });
            } catch (e) {
                console.warn('Captain UI Update Error:', e.message);
            }
        }
    },

    async resetLobby(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        await interaction.deferUpdate();

        const guild = interaction.guild;
        // Oyuncuları Geri Taşı
        if (match.lobbyVoiceId) {
            const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];
            // manager'daki forceMove ile aynı mantık kullanılabilir veya burada basitçe:
            // Sadece takımdakileri taşıyoruz, çünkü resetLobby "Lobi Bitir" değildir.
            // Ama temizlik için manager kullanmak daha iyi.
        }

        // Ses Kanallarını Sil (Manager'dan çağır)
        const manager = require('./manager');
        await manager.cleanupVoiceChannels(guild, match);

        // State Sıfırla
        match.captainA = null;
        match.captainB = null;
        match.teamA = [];
        match.teamB = [];
        match.status = 'SETUP';
        // createdChannelIds içinden sadece Text Kanalını tut (o silinmesin)
        match.createdChannelIds = match.createdChannelIds.filter(id => id === match.channelId);
        await match.save();

        const voiceChannel = interaction.guild.channels.cache.get(match.lobbyVoiceId); // DİNAMİK ID
        const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

        const memberOptions = voiceMembers.map(m => ({
            label: m.displayName,
            description: m.user.tag,
            value: m.id,
            emoji: '👤'
        })).slice(0, 25);

        if (memberOptions.length === 0) memberOptions.push({ label: 'Hata', value: 'null', description: 'Odada kimse yok' });

        const embed = new EmbedBuilder().setColor(0x5865F2)
            .setTitle(`🛡️ LOBİ YÖNETİMİ`)
            .setDescription(`**Lobi Sıfırlandı!**\nKaptanları yeniden belirleyin.\n\n👑 **Yetkili:** <@${match.hostId}>`)
            .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true })
            .setFooter({ text: `Nexora Competitive • Match #${match.matchNumber || '?'}` });

        const rows = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`match_cap_select_A_${match.matchId}`).setPlaceholder('Team A Kaptanı Seç').addOptions(memberOptions)
            ),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`match_cap_select_B_${match.matchId}`).setPlaceholder('Team B Kaptanı Seç').addOptions(memberOptions)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_randomcap_${match.matchId}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
            )
        ];

        await interaction.editReply({ content: null, embeds: [embed], components: rows });
    }
};
