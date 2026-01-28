const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, UserSelectMenuBuilder, ChannelType } = require('discord.js');
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
                .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true });

            const rows = [
                new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainA').setPlaceholder('Team A Kaptanı').setMaxValues(1)),
                new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainB').setPlaceholder('Team B Kaptanı').setMaxValues(1)),
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_randomcap_${interaction.id}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary))
            ];

            await textChannel.send({ content: `Match ID: ${interaction.id}\n<@${interaction.user.id}> maç oluşturuldu!`, embeds: [embed], components: rows });

            await interaction.editReply({ content: `✅ Maç oluşturuldu! Lütfen panele gidin:\nKanal: <#${textChannel.id}>` });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Maç oluşturulurken hata çıktı.' });
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
            await interaction.update({ embeds: [embed] });
        }
    }
};
