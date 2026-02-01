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

            // Sıralı Maç Numarasını Bul
            const lastMatch = await Match.findOne({ guildId: guild.id }).sort({ matchNumber: -1 });
            const currentMatchNumber = (lastMatch && lastMatch.matchNumber) ? lastMatch.matchNumber + 1 : 1;

            // 1. Kategori Kontrol (veya oluştur)
            let MATCH_CATEGORY_ID = getCategoryId();
            let category = guild.channels.cache.get(MATCH_CATEGORY_ID);
            if (!category) {
                category = await guild.channels.create({ name: '🏆 | ACTIVE MATCHES', type: ChannelType.GuildCategory });
                MATCH_CATEGORY_ID = category.id;
                setCategoryId(MATCH_CATEGORY_ID);
            }

            // 2. Özel Kanalları Oluştur (Dinamik Lobi - Sadece Yazı)
            const everyone = guild.roles.everyone;

            const textChannel = await guild.channels.create({
                name: `match-${currentMatchNumber}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: everyone.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.SendMessages] }
                ]
            });

            // 3. Veritabanı Kayıt
            const newMatch = new Match({
                matchId: interaction.id,
                guildId: guild.id,
                matchNumber: currentMatchNumber, // Yeni Eklenen Alan
                hostId: interaction.user.id,
                channelId: textChannel.id,
                lobbyVoiceId: REQUIRED_VOICE_ID,
                createdChannelIds: [textChannel.id],
                status: 'SETUP'
            });
            await newMatch.save();

            // 4. Panel Tasarımı (Modernize Edildi)
            const embed = new EmbedBuilder().setColor(0x5865F2)
                .setTitle(`🛡️ LOBİ YÖNETİMİ`)
                .setDescription(`**Lobi Hazır!**\nKaptanları belirleyip takımları kurmaya başlayın.\n\n👑 **Yetkili:** <@${interaction.user.id}>`)
                .addFields(
                    { name: '🔵 Team A', value: 'Wait...', inline: true },
                    { name: '🔴 Team B', value: 'Wait...', inline: true }
                )
                .setFooter({ text: `Nexora Competitive • Match #${currentMatchNumber}` });

            // 5. Ses Kanalındaki Üyeleri Getir
            const voiceChannel = guild.channels.cache.get(REQUIRED_VOICE_ID);
            const voiceMembers = voiceChannel ? voiceChannel.members.filter(m => !m.user.bot) : new Map();

            // Eğer kanalda kimse yoksa uyar ama devam et (Test için vs.)

            const memberOptions = voiceMembers.map(m => ({
                label: m.displayName,
                description: m.user.tag,
                value: m.id,
                emoji: '👤'
            })).slice(0, 25);

            if (memberOptions.length === 0) memberOptions.push({ label: 'Hata', value: 'null', description: 'Kimse bulunamadı' });

            // ID'lere Match ID eklendi: match_cap_select_A_MATCHID
            const rows = [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`match_cap_select_A_${interaction.id}`)
                        .setPlaceholder('Team A Kaptanı Seç')
                        .addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`match_cap_select_B_${interaction.id}`)
                        .setPlaceholder('Team B Kaptanı Seç')
                        .addOptions(memberOptions)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`match_randomcap_${interaction.id}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`match_cancel_${interaction.id}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
                )
            ];

            // Content temizlendi!
            await textChannel.send({ embeds: [embed], components: rows });

            await interaction.editReply({ content: `✅ Maç oluşturuldu! Lütfen panele gidin:\nKanal: <#${textChannel.id}>` });

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

        // Match ID Artık CustomID ile geliyor!
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
        if (!interaction.message.embeds || interaction.message.embeds.length === 0) {
            return interaction.reply({ content: '❌ Panel bulunamadı.', flags: require('discord.js').MessageFlags.Ephemeral });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        // Update fields
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
            // MENÜLERİ YENİLE
            const REQUIRED_VOICE_ID = '1463922466467483801';
            const voiceChannel = interaction.guild.channels.cache.get(REQUIRED_VOICE_ID);
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
                .setCustomId(`match_cap_select_A_${match.matchId}`) // ID EKLENDİ
                .setPlaceholder(match.captainA ? '✅ Seçildi' : 'Team A Kaptanı Seç')
                .setDisabled(!!match.captainA)
                .addOptions(optionsA.length > 0 ? optionsA.slice(0, 25) : [{ label: 'Uygun Aday Yok', value: 'null' }]);

            const optionsB = candidates.filter(c => c.value !== match.captainA);
            const selectB = new StringSelectMenuBuilder()
                .setCustomId(`match_cap_select_B_${match.matchId}`) // ID EKLENDİ
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

            await interaction.update({ embeds: [embed], components: rows });
        }
    },

    async resetLobby(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        await interaction.deferUpdate();

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

        const manager = require('./manager');
        await manager.cleanupVoiceChannels(guild, match);

        match.captainA = null;
        match.captainB = null;
        match.teamA = [];
        match.teamB = [];
        match.status = 'SETUP';
        match.createdChannelIds = match.createdChannelIds.filter(id => id === match.channelId);
        await match.save();

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
