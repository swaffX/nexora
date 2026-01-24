const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChannelType,
    PermissionsBitField,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ComponentType,
    AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

// Font Kaydı
GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');

// VALORANT Harita Havuzu (Güncel)
const MAPS = [
    { name: 'Abyss', img: 'https://cdn.mobalytics.gg/assets/valorant/images/maps/abyss-preview.png' },
    { name: 'Ascent', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt72ffc2b11ce3444e/5ebc4706977e4952089b0d38/Ascent_KeyArt.jpg' },
    { name: 'Bind', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt2253df64b2257d0d/5ebc4709d7dfae47672bb7e5/Bind_KeyArt.jpg' },
    { name: 'Breeze', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt25b597c9b0e9f1a2/607f2d5e324ef564756c9a96/Breeze_KeyArt.jpg' },
    { name: 'Fracture', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt910a34b223d7729f/6132717f9e830e0a5523a763/Fracture_KeyArt.jpg' },
    { name: 'Haven', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt5ebb68641a27e78e/5ebc470659a584346bcce209/Haven_KeyArt.jpg' },
    { name: 'Icebox', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt734914c995f92276/5f72782bcfb4685ff87e141a/Icebox_KeyArt.jpg' },
    { name: 'Lotus', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt43d9b4b0e77d2424/63ac73679f043b79ce459d4c/Lotus_KeyArt.jpg' },
    { name: 'Pearl', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltcf0472472d4220b3/62a245d820b8f4477813a408/Pearl_KeyArt.jpg' },
    { name: 'Split', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltd184c96825c317aa/5ebc47087617ca35520e5c26/Split_KeyArt.jpg' },
    { name: 'Sunset', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt9759d58ac91316b1/64e7d77b8118029519343337/Sunset_KeyArt.jpg' }
];

let MATCH_CATEGORY_ID = '1463883244436197397';

module.exports = {
    async handleInteraction(interaction, client) {
        // Özel ID kontrolü (create vs butonlar)
        let action;

        if (interaction.commandName === 'setup-match' || interaction.customId === 'match_create') {
            action = 'create';
        } else if (interaction.customId) {
            const parts = interaction.customId.split('_');
            // match_action_args...
            action = parts[1];
        }

        try {
            if (action === 'create') await this.createLobby(interaction);
            else if (action === 'captainA') await this.selectCaptain(interaction, 'A');
            else if (action === 'captainB') await this.selectCaptain(interaction, 'B');
            else if (action === 'randomcap') await this.assignRandomCaptains(interaction);
            else if (action === 'pick') await this.handlePlayerPick(interaction);
            else if (action === 'refresh') await this.refreshDraftUI(interaction);
            else if (action === 'vetoban') await this.handleMapBan(interaction);
            else if (action === 'sidepick') await this.handleSidePick(interaction);
            else if (action === 'endmatch') await this.endMatch(interaction);
            else if (action === 'randommap') await this.handleRandomMap(interaction);
            else if (action === 'winner') await this.handleMatchResult(interaction);
            else if (action === 'enddraft') await this.prepareMatchChannels(interaction, await Match.findOne({ matchId: interaction.customId.split('_')[2] }));
        } catch (error) {
            console.error(`Match Handler Error [${action}]:`, error);
            if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ İşlem sırasında hata!', ephemeral: true });
        }
    },

    async createLobby(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920';
        const REQUIRED_VOICE_ID = '1463922466467483801';

        // 1. Rol Kontrolü
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu işlemi yapmak için **Match Admin** yetkisine sahip değilsiniz!', ephemeral: true });
        }

        // 2. Özel Ses Kanalı Kontrolü
        if (interaction.member.voice.channelId !== REQUIRED_VOICE_ID) {
            return interaction.reply({
                content: `❌ Maç oluşturmak için <#${REQUIRED_VOICE_ID}> ses kanalında olmanız gerekmektedir!`,
                ephemeral: true
            });
        }

        // DB ve Kategori Kontrol
        let category = interaction.guild.channels.cache.get(MATCH_CATEGORY_ID);
        if (!category) {
            category = await interaction.guild.channels.create({ name: '🏆 | ACTIVE MATCHES', type: ChannelType.GuildCategory });
            MATCH_CATEGORY_ID = category.id;
        }

        const matchId = interaction.id;
        const lobbyChannelId = interaction.member.voice.channelId;

        // DB Başlat
        const newMatch = new Match({
            matchId: matchId,
            guildId: interaction.guild.id,
            hostId: interaction.user.id,
            channelId: interaction.channel.id,
            lobbyVoiceId: lobbyChannelId,
            status: 'SETUP',
            bannedMaps: []
        });
        await newMatch.save();

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('👑 Kaptan Seçimi')
            .setDescription('Kaptanları belirleyin veya **Rastgele Ata** butonuna basın.')
            .addFields(
                { name: '🔵 Team A Kaptanı', value: 'Seçilmedi', inline: true },
                { name: '🔴 Team B Kaptanı', value: 'Seçilmedi', inline: true }
            );

        const rows = [
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainA').setPlaceholder('Team A Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainB').setPlaceholder('Team B Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_randomcap_${matchId}`).setLabel('🎲 Rastgele Kaptan').setStyle(ButtonStyle.Secondary))
        ];

        await interaction.reply({ content: `Match ID: ${matchId}`, embeds: [embed], components: rows, ephemeral: true });
    },

    async selectCaptain(interaction, team) {
        const matchId = interaction.message.content.split('Match ID: ')[1];
        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı (DB Error).', ephemeral: true });

        const selectedId = interaction.values[0];

        if (team === 'A') {
            if (match.captainB === selectedId) return interaction.reply({ content: 'Aynı kişi iki takım olamaz!', ephemeral: true });
            match.captainA = selectedId;
            match.teamA = [selectedId];
        } else {
            if (match.captainA === selectedId) return interaction.reply({ content: 'Aynı kişi iki takım olamaz!', ephemeral: true });
            match.captainB = selectedId;
            match.teamB = [selectedId];
        }

        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async assignRandomCaptains(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: 'Ses kanalında değilsin!', ephemeral: true });

        const members = voiceChannel.members.filter(m => !m.user.bot).map(m => m.id);
        if (members.length < 2) return interaction.reply({ content: 'En az 2 oyuncu lazım.', ephemeral: true });

        const shuffled = members.sort(() => 0.5 - Math.random());
        match.captainA = shuffled[0]; match.teamA = [shuffled[0]];
        match.captainB = shuffled[1]; match.teamB = [shuffled[1]];

        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async updateCaptainUI(interaction, match) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(0, 2,
            { name: '🔵 Team A Kaptanı', value: match.captainA ? `<@${match.captainA}>` : 'Seçilmedi', inline: true },
            { name: '🔴 Team B Kaptanı', value: match.captainB ? `<@${match.captainB}>` : 'Seçilmedi', inline: true }
        );

        if (match.captainA && match.captainB) {
            match.status = 'DRAFT';
            await match.save();
            await this.startDraftMode(interaction, match);
        } else {
            await interaction.update({ embeds: [embed] });
        }
    },

    async startDraftMode(interaction, match) {
        const member = await interaction.guild.members.fetch(match.hostId).catch(() => null);
        const channel = member?.voice?.channel;

        if (!channel) return interaction.update({ content: '❌ Host ses kanalında değil!', components: [] });

        if (!match.lobbyVoiceId) {
            match.lobbyVoiceId = channel.id;
            await match.save();
        }

        const players = channel.members
            .filter(m => !m.user.bot && m.id !== match.captainA && m.id !== match.captainB)
            .map(m => m.id);

        match.availablePlayerIds = players;
        await match.save();
        return this.updateDraftUI(interaction, match);
    },

    async updateDraftUI(interaction, match) {
        if ((match.teamA.length >= 5 && match.teamB.length >= 5) || match.availablePlayerIds.length === 0) {
            return this.prepareMatchChannels(interaction, match);
        }

        const currentTurnCaptain = match.pickTurn === 'A' ? match.captainA : match.captainB;

        const poolOptions = [];
        for (const pid of match.availablePlayerIds) {
            try {
                const p = await interaction.guild.members.fetch(pid);
                poolOptions.push({ label: p.displayName.substring(0, 25), value: p.id, emoji: '👤' });
            } catch (e) { }
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('👥 Draft Aşaması')
            .setDescription(`**Sıra:** <@${currentTurnCaptain}> (Team ${match.pickTurn})`)
            .addFields(
                { name: `🔵 Team A (${match.teamA.length})`, value: match.teamA.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: `🔴 Team B (${match.teamB.length})`, value: match.teamB.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: '📍 Havuz', value: poolOptions.map(p => p.label).join(', ') || 'Kimse kalmadı', inline: false }
            );

        const components = [];
        if (poolOptions.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_pick_${match.matchId}`)
                    .setPlaceholder(`Oyuncu Seç (Team ${match.pickTurn})`)
                    .addOptions(poolOptions.slice(0, 25))
            ));
        } else {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_enddraft_${match.matchId}`).setLabel('Seçimi Bitir & Veto').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`match_randommap_${match.matchId}`).setLabel('🎲 Rastgele Harita & Başlat').setStyle(ButtonStyle.Primary)
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_refresh_${match.matchId}`).setLabel('🔄 Yenile').setStyle(ButtonStyle.Secondary)
        ));

        if (interaction.isMessageComponent()) await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
        else await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
    },

    async handlePlayerPick(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const currentCap = match.pickTurn === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== currentCap) return interaction.reply({ content: 'Sıra sende değil!', ephemeral: true });

        const pickedId = interaction.values[0];

        if (match.pickTurn === 'A') {
            match.teamA.push(pickedId);
            match.pickTurn = 'B';
        } else {
            match.teamB.push(pickedId);
            match.pickTurn = 'A';
        }

        match.availablePlayerIds = match.availablePlayerIds.filter(id => id !== pickedId);
        await match.save();
        await this.updateDraftUI(interaction, match);
    },

    async refreshDraftUI(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        const host = await interaction.guild.members.fetch(match.hostId);
        const channel = host.voice.channel;

        if (channel) {
            const currentPlayers = [...match.teamA, ...match.teamB];
            const newPool = channel.members.filter(m => !m.user.bot && !currentPlayers.includes(m.id)).map(m => m.id);
            match.availablePlayerIds = newPool;
            await match.save();
        }
        await this.updateDraftUI(interaction, match);
    },

    async prepareMatchChannels(interaction, match) {
        match.status = 'VETO';
        await match.save();

        const embedInit = new EmbedBuilder().setColor(0x57F287).setTitle('🚀 Hazırlanıyor...').setDescription('Kanallar oluşturuluyor, oyuncular taşınıyor...');
        await interaction.update({ embeds: [embedInit], components: [] });

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;

        const vetoChannel = await guild.channels.create({
            name: `🗳️・map-veto`,
            type: ChannelType.GuildText,
            parent: MATCH_CATEGORY_ID,
            permissionOverwrites: [
                { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...[...match.teamA, ...match.teamB].map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
            ]
        });
        match.createdChannelIds.push(vetoChannel.id);
        await match.save();

        this.updateVetoUI(vetoChannel, match);
    },

    async updateVetoUI(channel, match) {
        const remainingMaps = MAPS.filter(m => !match.bannedMaps.includes(m.name));

        if (remainingMaps.length === 1) {
            match.selectedMap = remainingMaps[0].name;
            match.status = 'SIDE_SELECTION';
            await match.save();
            return this.startSideSelection(channel, match);
        }

        const turnCap = match.vetoTurn === 'A' ? match.captainA : match.captainB;

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🗺️ Map Veto (Yasaklama)')
            .setDescription(`**Sıra:** <@${turnCap}> (Team ${match.vetoTurn})\nLütfen oynamak **İSTEMEDİĞİNİZ** haritayı yasaklayın.`)
            .setImage(remainingMaps[0].img)
            .addFields(
                { name: 'Kalan Haritalar', value: remainingMaps.map(m => `✅ ${m.name}`).join('\n') },
                { name: 'Yasaklananlar', value: match.bannedMaps.join(', ') || 'Yok' }
            );

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`match_vetoban_${match.matchId}`)
                .setPlaceholder('Bir harita YASAKLA')
                .addOptions(remainingMaps.map(m => ({ label: m.name, value: m.name, emoji: '🚫' })))
        );

        await channel.send({ content: `<@${turnCap}>`, embeds: [embed], components: [row] });
    },

    async handleMapBan(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        const turnCap = match.vetoTurn === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== turnCap) return interaction.reply({ content: 'Sıra sende değil!', ephemeral: true });

        const bannedMap = interaction.values[0];
        match.bannedMaps.push(bannedMap);

        match.vetoTurn = match.vetoTurn === 'A' ? 'B' : 'A';
        await match.save();

        await interaction.update({ content: `🚫 **${bannedMap}** yasaklandı!`, components: [] });
        await this.updateVetoUI(interaction.channel, match);
    },

    async startSideSelection(channel, match) {
        const winner = Math.random() < 0.5 ? 'A' : 'B';
        match.coinFlipWinner = winner;
        await match.save();

        const winnerId = winner === 'A' ? match.captainA : match.captainB;
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🏰 Harita: ${match.selectedMap}`)
            .setDescription(`**Yazı-Tura Kazananı:** Team ${winner} (<@${winnerId}>)\n\nLütfen tarafınızı seçin: **Saldırı (Attack)** veya **Savunma (Defend)**`)
            .setImage(mapData ? mapData.img : null);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_ATTACK`).setLabel('🗡️ Attack').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_DEFEND`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Success)
        );

        await channel.send({ content: `<@${winnerId}>`, embeds: [embed], components: [row] });
    },

    async handleSidePick(interaction) {
        const [_, __, matchId, side] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });

        const winnerId = match.coinFlipWinner === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== winnerId) return interaction.reply({ content: 'Bu kararı sadece yazı-turayı kazanan verebilir!', ephemeral: true });

        if (match.coinFlipWinner === 'A') {
            match.sideA = side;
            match.sideB = side === 'ATTACK' ? 'DEFEND' : 'ATTACK';
        } else {
            match.sideB = side;
            match.sideA = side === 'ATTACK' ? 'DEFEND' : 'ATTACK';
        }

        match.status = 'LIVE';
        await match.save();
        await interaction.update({ components: [] });

        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async setupVoiceAndStart(guild, match, infoChannel) {
        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;

        const nameA = `🔵 Team A (${match.sideA === 'ATTACK' ? 'Attack' : 'Defend'})`;
        const nameB = `🔴 Team B (${match.sideB === 'ATTACK' ? 'Attack' : 'Defend'})`;

        const createPerms = (teamIds) => [
            { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))
        ];

        const voiceA = await guild.channels.create({ name: nameA, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
        const voiceB = await guild.channels.create({ name: nameB, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

        match.createdChannelIds.push(voiceA.id);
        match.createdChannelIds.push(voiceB.id);
        await match.save();

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        const panelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir & Sil').setStyle(ButtonStyle.Danger)
        );

        await infoChannel.send({
            content: `✅ **MAÇ BAŞLADI!**\nHarita: **${match.selectedMap}**\nTeam A: **${match.sideA}** vs Team B: **${match.sideB}**\n\nİyi Oyunlar! 🎮`,
            components: [panelRow]
        });
    },

    async endMatch(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', ephemeral: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_A`).setLabel('🏆 Team A Kazandı').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_B`).setLabel('🏆 Team B Kazandı').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_CANCEL`).setLabel('❌ İptal / Sonuçsuz').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: '🏁 **Maç Sonucu:** Lütfen kazanan takımı seçin.\n*(Seçimden sonra kanallar silinecek ve sonuç loglanacaktır)*',
            components: [row],
            ephemeral: true
        });
    },

    async handleRandomMap(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });

        if (!match) return;
        if (interaction.user.id !== match.captainA && interaction.user.id !== match.captainB) {
            return interaction.reply({ content: 'Sadece kaptanlar bunu yapabilir!', ephemeral: true });
        }

        const randomMap = MAPS[Math.floor(Math.random() * MAPS.length)].name;
        match.selectedMap = randomMap;

        match.sideA = Math.random() < 0.5 ? 'ATTACK' : 'DEFEND';
        match.sideB = match.sideA === 'ATTACK' ? 'DEFEND' : 'ATTACK';

        match.status = 'LIVE';
        await match.save();

        const embedInit = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎲 Rastgele Seçim Yapıldı!')
            .setDescription(`**Harita:** ${randomMap}\n**Team A:** ${match.sideA}\n\nMaç başlatılıyor...`);

        await interaction.update({ embeds: [embedInit], components: [] });

        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async handleMatchResult(interaction) {
        const [_, __, matchId, winner] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });

        if (!match) return interaction.update({ content: 'Maç verisi yok.', components: [] });

        await interaction.update({ content: '⏳ **Sonuç işleniyor...** Resim oluşturuluyor ve kanallar temizleniyor.', components: [] });

        if (winner !== 'CANCEL') {
            const betReport = await this.processBets(interaction.guild, match, winner);
            await this.generateResultCard(interaction.guild, match, winner, betReport);
        }

        await this.cleanupMatch(interaction.guild, match);
    },

    async generateResultCard(guild, match, winnerTeam, betReport = null) {
        try {
            let resultChannel = guild.channels.cache.find(c => c.name === 'maç-sonuçları');
            if (!resultChannel) {
                resultChannel = await guild.channels.create({
                    name: 'maç-sonuçları',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.SendMessages] }]
                });
            }

            const winningTeamIds = winnerTeam === 'A' ? match.teamA : match.teamB;
            const teamName = winnerTeam === 'A' ? 'TEAM A' : 'TEAM B';
            const color = winnerTeam === 'A' ? '#5865F2' : '#ED4245';

            const canvas = createCanvas(800, 450);
            const ctx = canvas.getContext('2d');

            const mapData = MAPS.find(m => m.name === match.selectedMap) || MAPS[0];
            try {
                const bg = await loadImage(mapData.img);
                ctx.drawImage(bg, 0, 0, 800, 450);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, 800, 450);
            } catch (e) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, 800, 450);
            }

            ctx.textAlign = 'center';
            ctx.font = '80px VALORANT';
            ctx.fillStyle = color;
            ctx.shadowColor = "black";
            ctx.shadowBlur = 10;
            ctx.fillText('VICTORY', 400, 100);

            ctx.font = '40px VALORANT';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${teamName} WON`, 400, 150);

            for (let i = 0; i < winningTeamIds.length; i++) {
                const userId = winningTeamIds[i];
                try {
                    const member = await guild.members.fetch(userId);
                    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true });
                    const avatar = await loadImage(avatarURL);

                    const x = 100 + (i * 130);
                    const y = 220;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x + 50, y + 50, 50, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(avatar, x, y, 100, 100);
                    ctx.restore();

                    ctx.font = '18px VALORANT';
                    ctx.fillStyle = 'white';
                    ctx.fillText(member.displayName.substring(0, 12), x + 50, y + 130);
                } catch (e) { }
            }

            ctx.font = '20px Arial';
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(`Map: ${match.selectedMap} • ${new Date().toLocaleDateString('tr-TR')}`, 400, 420);

            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'match-result.png' });

            const embed = new EmbedBuilder()
                .setColor(winnerTeam === 'A' ? 0x5865F2 : 0xED4245)
                .setTitle(`🏆 Maç Sonucu: ${teamName} Kazandı!`)
                .setDescription(`🗓️ **Tarih:** <t:${Math.floor(Date.now() / 1000)}:f>\n🗺️ **Harita:** ${match.selectedMap}`)
                .addFields(
                    { name: '🔵 Team A', value: match.teamA.map(id => `<@${id}>`).join(', '), inline: true },
                    { name: '🔴 Team B', value: match.teamB.map(id => `<@${id}>`).join(', '), inline: true }
                )
                .setImage('attachment://match-result.png')
                .setFooter({ text: `Match ID: ${match.matchId}` });

            if (betReport) {
                embed.addFields({ name: '📈 Bahis Durumu', value: betReport.length > 1024 ? betReport.substring(0, 1021) + '...' : betReport });
            }

            await resultChannel.send({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Result Card Error:', error);
        }
    },

    async processBets(guild, match, winnerTeam) {
        if (!match.bets || match.bets.length === 0) return null;

        let winners = [];

        for (const bet of match.bets) {
            if (bet.team === winnerTeam && !bet.claimed) {
                const winAmount = bet.amount * 2;
                try {
                    const user = await User.findOne({ odasi: bet.userId, odaId: guild.id });
                    if (user) {
                        user.balance += winAmount;
                        await user.save();
                        winners.push(`<@${bet.userId}> (+${winAmount})`);
                        bet.claimed = true;
                    }
                } catch (e) {
                    console.error('Bahis ödeme hatası:', e);
                }
            }
        }
        await match.save();

        if (winners.length > 0) {
            return `💰 **Bahis Kazananları:**\n${winners.join(', ')}`;
        }
        return "💰 **Bahis:** Bu maça bahis oynayanlardan kazanan çıkmadı.";
    },

    async cleanupMatch(guild, match) {
        if (match.lobbyVoiceId) {
            const allPlayers = [...match.teamA, ...match.teamB];
            for (const id of allPlayers) {
                try {
                    const m = await guild.members.fetch(id);
                    if (m.voice.channel) await m.voice.setChannel(match.lobbyVoiceId);
                } catch (e) { }
            }
        }

        setTimeout(async () => {
            for (const cid of match.createdChannelIds) {
                try {
                    const c = guild.channels.cache.get(cid);
                    if (c) await c.delete();
                } catch (e) { }
            }
            match.status = 'FINISHED';
            await match.save();
        }, 3000);
    },
    async checkTimeouts(client) {
        const TIMEOUT_MS = 5 * 60 * 1000; // 5 dakika
        const cutoff = new Date(Date.now() - TIMEOUT_MS);

        try {
            // Tamamlanmamış ve süresi geçmiş maçları bul (updatedAt)
            const matches = await Match.find({
                status: { $in: ['SETUP', 'DRAFT', 'VETO', 'SIDE_SELECTION'] },
                updatedAt: { $lt: cutoff }
            });

            if (matches.length > 0) {
                console.log(`[Auto-Timeout] ${matches.length} maç zaman aşımına uğradı.`);

                for (const match of matches) {
                    const guild = client.guilds.cache.get(match.guildId);
                    if (guild) {
                        // Bildirim
                        const channel = guild.channels.cache.get(match.channelId);
                        if (channel) {
                            const embed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle('⏰ Zaman Aşımı')
                                .setDescription('Maç kurulumu sırasında 5 dakika boyunca işlem yapılmadığı için maç **iptal edildi**.');
                            await channel.send({ content: `<@${match.hostId}>`, embeds: [embed] }).catch(() => { });
                        }

                        // Kanalları Sil
                        if (match.createdChannelIds && match.createdChannelIds.length > 0) {
                            for (const cid of match.createdChannelIds) {
                                try { guild.channels.cache.get(cid)?.delete(); } catch (e) { }
                            }
                        }

                        // Voice Geri Taşıma (cleanupMatch içindeki logic'in basitleştirilmiş hali)
                        if (match.lobbyVoiceId) {
                            const allPlayers = [...match.teamA, ...match.teamB];
                            for (const id of allPlayers) {
                                try {
                                    const m = await guild.members.fetch(id);
                                    if (m.voice.channel) await m.voice.setChannel(match.lobbyVoiceId);
                                } catch (e) { }
                            }
                        }
                    }
                    match.status = 'CANCELLED';
                    await match.save();
                }
            }
        } catch (error) {
            console.error('[Timeout Error]', error);
        }
    }
};
