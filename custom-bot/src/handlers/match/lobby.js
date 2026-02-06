const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const draftHandler = require('./draft');
const { getLobbyConfig, BLOCKED_ROLE_ID } = require('./constants');
const eloService = require('../../services/eloService');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    async createLobby(interaction, targetLobbyId, initialLobbyCode = null, overriddenVoiceId = null) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        const { MessageFlags, PermissionsBitField } = require('discord.js');

        // Yetki Kontrolü
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }

        // Lobi Configini Al
        let lobbyConfig = getLobbyConfig(targetLobbyId);

        // Dinamik Override (Merkezi Hub Sistemi)
        if (overriddenVoiceId) {
            lobbyConfig = {
                voiceId: overriddenVoiceId,
                categoryId: interaction.channel.parentId, // Panel ile aynı kategoriye aç
                name: `Lobby ${targetLobbyId}`
            };
        }

        if (!lobbyConfig) {
            return interaction.reply({ content: '❌ Geçersiz Lobi ID veya konfigürasyon bulunamadı.', flags: MessageFlags.Ephemeral });
        }

        const REQUIRED_VOICE_ID = lobbyConfig.voiceId;
        const MATCH_CATEGORY_ID = lobbyConfig.categoryId;

        // Admin ses kanalında mı?
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
                return interaction.editReply({ content: `❌ Kategori bulunamadı! (ID: ${MATCH_CATEGORY_ID})` });
            }

            // --- GÜVENLİK KONTROLLERİ (RİSK ÖNLEME) ---

            // 1. Kategori Doluluğu (Discord 50 Kanal Limiti)
            // Cache her zaman güncel olmayabilir, fetch yapıp saymak daha güvenlidir ama yavaştır. Cache yeterli.
            if (category.children.cache.size >= 47) {
                return interaction.editReply({ content: '❌ **Sistem Uyarısı:** Bu lobi kategorisi kapasitesini doldurmak üzere (Max 50 Kanal). Lütfen devam eden maçların bitmesini bekleyin.' });
            }

            // 2. Bot Yetkileri
            const botMember = guild.members.me;
            if (!botMember.permissions.has([PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers, PermissionsBitField.Flags.ManageRoles])) {
                return interaction.editReply({ content: '❌ **Kritik Hata:** Botun `Manage Channels`, `Move Members` veya `Manage Roles` yetkisi eksik!' });
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
                    allow: [PermissionsBitField.Flags.ViewChannel],
                    deny: [PermissionsBitField.Flags.SendMessages]
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
                lobbyVoiceId: REQUIRED_VOICE_ID,
                createdChannelIds: [textChannel.id],
                status: 'SETUP',
                lobbyCode: initialLobbyCode ? initialLobbyCode.toUpperCase() : null
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

        await interaction.reply({ content: '🚫 Maç iptal ediliyor, oyuncular taşınıyor...' });

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        try {
            if (match) {
                const guild = interaction.guild;

                // --- OYUNCULARI GERİ TAŞI ---
                if (match.lobbyVoiceId) {
                    // Oluşturulan ses kanallarındaki herkesi bul ve taşı
                    if (match.createdChannelIds) {
                        for (const cid of match.createdChannelIds) {
                            try {
                                const channel = guild.channels.cache.get(cid) || await guild.channels.fetch(cid).catch(() => null);
                                if (channel && channel.type === ChannelType.GuildVoice) {
                                    for (const [memberId, member] of channel.members) {
                                        await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                                    }
                                }
                            } catch (e) { }
                        }
                    }

                    // Ayrıca Team A ve Team B listesindekileri de kontrol et (farklı yerdeyse çek)
                    const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];
                    for (const pid of allPlayers) {
                        try {
                            const member = await guild.members.fetch(pid).catch(() => null);
                            if (member && member.voice.channelId && member.voice.channelId !== match.lobbyVoiceId) {
                                // Sadece eğer botun oluşturduğu bir kanaldaysa mı çekelim? 
                                // "Herkesi taşı" dediği için direkt lobiye çekmek en mantıklısı.
                                await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                            }
                        } catch (e) { }
                    }
                }

                // Biraz bekle
                await new Promise(define => setTimeout(define, 2000));

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
            // Kanal silinmiş olabilir, reply atamayabiliriz
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
            match.status = 'DRAFT_COINFLIP';
            await match.save();
            await interaction.message.delete().catch(() => { });

            // Draft yerine önce Kaptanlar Arası Yazı Tura (Pick Order)
            await this.startDraftCoinFlip(interaction.channel, match);
        } else {
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


    async startDraftCoinFlip(channel, match) {
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🎡 KAPTANLAR KURA ÇARKI')
            .setDescription(`**Kaptanlar Hazır!**\n\nİlk seçim hakkını (Harita/Taraf) kimin alacağını belirlemek için çarkı çevirin.\n\n🔵 **Team A:** <@${match.captainA}>\n🔴 **Team B:** <@${match.captainB}>\n\nHerhangi bir kaptan çevirebilir!`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2855/2855473.png'); // Wheel Icon

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_draftcoin_${match.matchId}`).setLabel('🎡 Çarkı Çevir').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`match_autobalance_${match.matchId}`).setLabel('⚖️ Takımları Dengele').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await channel.send({ content: `<@${match.captainA}> <@${match.captainB}>`, embeds: [embed], components: [row] });
    },

    async handleDraftCoinFlip(interaction) {
        const { MessageFlags, AttachmentBuilder } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        if (!match) return;
        if (interaction.user.id !== match.captainA && interaction.user.id !== match.captainB) {
            return interaction.reply({ content: 'Sadece kaptanlar çarkı çevirebilir!', flags: MessageFlags.Ephemeral });
        }

        // 1. Animasyon Mesajı (GIF)
        const animationEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎡 ÇARK DÖNÜYOR...')
            .setDescription('Kaptanlar için şans perisi dönüyor... Acaba kim kazanacak?')
            .setImage('https://media.tenor.com/-eJ9y3A-0iMAAAAM/spinning-wheel-spin.gif'); // Spinning Wheel GIF

        await interaction.update({ content: null, embeds: [animationEmbed], components: [] });

        // 2. Bekle (4 Saniye)
        await new Promise(r => setTimeout(r, 4000));

        // 3. Sonuç Belirle
        const winnerTeam = Math.random() < 0.5 ? 'A' : 'B';
        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;
        const loserId = winnerTeam === 'A' ? match.captainB : match.captainA;

        match.status = 'DRAFT_CHOICE';
        await match.save();

        // 4. Canvas Görseli Oluştur
        const winnerUser = await interaction.guild.members.fetch(winnerId).catch(() => null);
        const loserUser = await interaction.guild.members.fetch(loserId).catch(() => null);

        const winnerData = {
            name: winnerUser?.displayName || (winnerTeam === 'A' ? 'Team A' : 'Team B'),
            user: winnerUser?.user || { displayAvatarURL: () => '' },
            team: winnerTeam
        };
        const loserData = {
            name: loserUser?.displayName || 'Loser',
            user: loserUser?.user || { displayAvatarURL: () => '' },
            team: winnerTeam === 'A' ? 'B' : 'A'
        };

        let attachment = null;
        try {
            const buffer = await canvasGenerator.createWheelResult(winnerData, loserData);
            attachment = new AttachmentBuilder(buffer, { name: 'wheel-result.png' });
        } catch (e) { console.error('Wheel Canvas Error:', e); }

        const resultEmbed = new EmbedBuilder()
            .setColor(winnerTeam === 'A' ? 0x3498DB : 0xE74C3C)
            .setTitle('🎉 KURA SONUCU!')
            .setDescription(`**Kazanan:** <@${winnerId}> (Team ${winnerTeam})\n\n**Seçim Hakkı Sizde!** Hangisini istersiniz?\n\n👤 **Player Priority:** İlk oyuncuyu sen seçersin.\n🛡️ **Side Priority:** Tarafı (Saldırı/Savunma) sen seçersin.`);

        if (attachment) resultEmbed.setImage('attachment://wheel-result.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_priority_PLAYER_${match.matchId}_${winnerTeam}`).setLabel('İlk Oyuncuyu Seç').setStyle(ButtonStyle.Primary).setEmoji('👤'),
            new ButtonBuilder().setCustomId(`match_priority_SIDE_${match.matchId}_${winnerTeam}`).setLabel('Taraf Seçme Hakkı').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('Maçı İptal Et').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );

        const payload = { embeds: [resultEmbed], components: [row] };
        if (attachment) payload.files = [attachment];

        // Mesajı güncelle
        try {
            await interaction.editReply(payload);
        } catch (e) {
            // Eğer interaction süresi dolduysa fallback
            await interaction.channel.send(payload);
        }
    },

    async handleDraftPriorityChoice(interaction) {
        const parts = interaction.customId.split('_');
        const choice = parts[2]; // PLAYER or SIDE
        const matchId = parts[3];
        const winnerTeam = parts[4]; // A or B

        const match = await Match.findOne({ matchId });
        if (!match) return;

        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== winnerId) {
            return interaction.reply({ content: 'Bu seçimi sadece Yazı Turayı kazanan kaptan yapabilir!', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
        const loserId = loserTeam === 'A' ? match.captainA : match.captainB;

        let description = "";

        if (choice === 'PLAYER') {
            // Kazanan -> İlk Pick
            // Kaybeden -> Taraf Seçimi (Oyun başlayınca)
            match.pickTurn = winnerTeam;
            match.sideSelector = loserId;
            description = `✅ **Karar:** <@${winnerId}> **İlk Oyuncu Seçimini** aldı.\n🛡️ **<@${loserId}>** ise oyun başlayınca **Taraf Seçimi** yapacak.`;
        } else {
            // Kazanan -> Taraf Seçimi
            // Kaybeden -> İlk Pick
            match.pickTurn = loserTeam;
            match.sideSelector = winnerId;
            description = `✅ **Karar:** <@${winnerId}> **Taraf Seçim Hakkını** aldı.\n👤 **<@${loserId}>** ise **İlk Oyuncuyu** seçecek.`;
        }

        match.status = 'DRAFT';
        await match.save();

        await interaction.update({ content: description, components: [], embeds: [] });
        setTimeout(() => interaction.message.delete().catch(() => { }), 5000);

        // Draft Sistemini Başlat
        const draftHandler = require('./draft');
        await draftHandler.startDraftMode(interaction, match);
    },

    async resetLobby(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        await interaction.deferUpdate();

        const guild = interaction.guild;
        const manager = require('./manager');
        await manager.cleanupVoiceChannels(guild, match);

        match.captainA = null;
        match.captainB = null;
        match.teamA = [];
        match.teamB = [];
        match.status = 'SETUP';
        match.createdChannelIds = match.createdChannelIds.filter(id => id === match.channelId);
        await match.save();

        const voiceChannel = interaction.guild.channels.cache.get(match.lobbyVoiceId);
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
    },

    /**
     * Takımları ELO'ya göre otomatik dengele
     */
    async handleAutoBalance(interaction) {
        const { MessageFlags } = require('discord.js');
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        if (!match) {
            return interaction.reply({ content: '❌ Maç bulunamadı.', flags: MessageFlags.Ephemeral });
        }

        // Yetki kontrolü (sadece kaptanlar veya admin)
        if (interaction.user.id !== match.captainA && interaction.user.id !== match.captainB) {
            return interaction.reply({ content: '❌ Sadece kaptanlar bu işlemi yapabilir!', flags: MessageFlags.Ephemeral });
        }

        // Ses kanalındaki oyuncuları al
        const voiceChannel = interaction.guild.channels.cache.get(match.lobbyVoiceId);
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Lobi ses kanalı bulunamadı!', flags: MessageFlags.Ephemeral });
        }

        const voiceMembers = voiceChannel.members.filter(m => !m.user.bot);
        const playerIds = voiceMembers.map(m => m.id);

        if (playerIds.length < 4) {
            return interaction.reply({ content: '❌ Dengeleme için en az 4 oyuncu gerekli.', flags: MessageFlags.Ephemeral });
        }

        // Tüm oyuncuların ELO bilgilerini çek
        const playersWithElo = [];
        for (const pid of playerIds) {
            const userDoc = await User.findOne({ odasi: pid, odaId: interaction.guild.id });
            const elo = userDoc?.matchStats?.elo || eloService.ELO_CONFIG.DEFAULT_ELO;
            playersWithElo.push({ odasi: pid, elo });
        }

        // ELO'ya göre dengele
        const balanced = eloService.balanceTeams(playersWithElo);

        // Kaptanları koru (Team A'nın ilk elemanı captainA, Team B'nin ilk elemanı captainB olmalı)
        // Eğer kaptan doğru takımda değilse swap yap
        if (!balanced.teamA.includes(match.captainA) && balanced.teamB.includes(match.captainA)) {
            // CaptainA Team B'de, swap et
            const temp = balanced.teamA;
            balanced.teamA = balanced.teamB;
            balanced.teamB = temp;
        }

        // Kaptanları listenin başına koy
        balanced.teamA = [match.captainA, ...balanced.teamA.filter(id => id !== match.captainA)];
        balanced.teamB = [match.captainB, ...balanced.teamB.filter(id => id !== match.captainB)];

        // Match'i güncelle
        match.teamA = balanced.teamA;
        match.teamB = balanced.teamB;
        await match.save();

        // Takım ortalamalarını hesapla
        let avgA = 0, avgB = 0;
        for (const p of playersWithElo) {
            if (balanced.teamA.includes(p.odasi)) avgA += p.elo;
            if (balanced.teamB.includes(p.odasi)) avgB += p.elo;
        }
        avgA = Math.round(avgA / balanced.teamA.length);
        avgB = Math.round(avgB / balanced.teamB.length);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('⚖️ Takımlar Dengelendi!')
            .setDescription(`Oyuncular ELO'ya göre adil şekilde dağıtıldı.`)
            .addFields(
                { name: `🔵 Team A (Avg: ${avgA})`, value: balanced.teamA.map(id => `<@${id}>`).join('\n'), inline: true },
                { name: `🔴 Team B (Avg: ${avgB})`, value: balanced.teamB.map(id => `<@${id}>`).join('\n'), inline: true }
            )
            .setFooter({ text: 'Yazı tura ile devam edebilirsiniz.' });

        // Yazı tura butonunu güncelle
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_draftcoin_${match.matchId}`).setLabel('🎲 Parayı Havaya At').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
            new ButtonBuilder().setCustomId(`match_autobalance_${match.matchId}`).setLabel('⚖️ Tekrar Dengele').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.update({ embeds: [embed], components: [row] });
    }
};
