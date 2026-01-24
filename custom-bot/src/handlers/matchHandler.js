const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, StringSelectMenuBuilder,
    UserSelectMenuBuilder, ComponentType, AttachmentBuilder
} = require('discord.js');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');

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
        let action;
        if (interaction.commandName === 'setup-match' || interaction.customId === 'match_create') action = 'create';
        else if (interaction.customId) {
            const parts = interaction.customId.split('_');
            action = parts[1];
        }

        try {
            if (action === 'create') await this.createLobby(interaction);
            else if (action === 'captainA') await this.selectCaptain(interaction, 'A');
            else if (action === 'captainB') await this.selectCaptain(interaction, 'B');
            else if (action === 'randomcap') await this.assignRandomCaptains(interaction);
            else if (action === 'pick') await this.handlePlayerPick(interaction);
            else if (action === 'refresh') await this.refreshDraftUI(interaction);
            else if (action === 'vote') await this.handleMapVote(interaction);
            else if (action === 'sidepick') await this.handleSidePick(interaction);
            else if (action === 'endmatch') await this.endMatch(interaction);
            else if (action === 'randommap') await this.handleRandomMap(interaction);
            else if (action === 'winner') await this.handleMatchResult(interaction);
            else if (action === 'enddraft') await this.prepareVoting(interaction, await Match.findOne({ matchId: interaction.customId.split('_')[2] }), true);
        } catch (error) {
            console.error(`Match Handler Error [${action}]:`, error);
            if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ İşlem sırasında hata!', ephemeral: true });
        }
    },

    async createLobby(interaction) {
        const REQUIRED_ROLE_ID = '1463875325019557920'; const REQUIRED_VOICE_ID = '1463922466467483801';
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) return interaction.reply({ content: '❌ Yetkiniz yok.', ephemeral: true });
        if (interaction.member.voice.channelId !== REQUIRED_VOICE_ID) return interaction.reply({ content: `❌ <#${REQUIRED_VOICE_ID}> kanalında olmalısınız!`, ephemeral: true });

        let category = interaction.guild.channels.cache.get(MATCH_CATEGORY_ID);
        if (!category) {
            category = await interaction.guild.channels.create({ name: '🏆 | ACTIVE MATCHES', type: ChannelType.GuildCategory });
            MATCH_CATEGORY_ID = category.id;
        }

        const matchId = interaction.id;
        const newMatch = new Match({
            matchId: matchId, guildId: interaction.guild.id, hostId: interaction.user.id,
            channelId: interaction.channel.id, lobbyVoiceId: interaction.member.voice.channelId, status: 'SETUP'
        });
        await newMatch.save();

        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('👑 Kaptan Seçimi').setDescription('Kaptanları belirleyin.')
            .addFields({ name: '🔵 Team A', value: 'Seçilmedi', inline: true }, { name: '🔴 Team B', value: 'Seçilmedi', inline: true });

        const rows = [
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainA').setPlaceholder('Team A Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('match_captainB').setPlaceholder('Team B Kaptanı').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_randomcap_${matchId}`).setLabel('🎲 Rastgele').setStyle(ButtonStyle.Secondary))
        ];

        await interaction.reply({ content: `Match ID: ${matchId}`, embeds: [embed], components: rows, ephemeral: false });
    },

    async selectCaptain(interaction, team) {
        const matchId = interaction.message.content.split('Match ID: ')[1];
        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', ephemeral: true });

        const selectedId = interaction.values[0];
        if (team === 'A') {
            if (match.captainB === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', ephemeral: true });
            match.captainA = selectedId; match.teamA = [selectedId];
        } else {
            if (match.captainA === selectedId) return interaction.reply({ content: 'Aynı kişi seçilemez!', ephemeral: true });
            match.captainB = selectedId; match.teamB = [selectedId];
        }
        await match.save();
        await this.updateCaptainUI(interaction, match);
    },

    async assignRandomCaptains(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
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
            await interaction.message.delete().catch(() => { });
            await this.startDraftMode(interaction, match);
        } else {
            await interaction.update({ embeds: [embed] });
        }
    },

    async startDraftMode(interaction, match) {
        const member = await interaction.guild.members.fetch(match.hostId).catch(() => null);
        const channel = member?.voice?.channel;

        if (!channel) return interaction.channel.send({ content: '❌ Host ses kanalında değil!' }).then(m => setTimeout(() => m.delete(), 5000));

        if (!match.lobbyVoiceId) { match.lobbyVoiceId = channel.id; await match.save(); }

        const players = channel.members
            .filter(m => !m.user.bot && m.id !== match.captainA && m.id !== match.captainB)
            .map(m => m.id);

        match.availablePlayerIds = players;
        await match.save();
        return this.updateDraftUI(interaction, match, true);
    },

    async updateDraftUI(interaction, match, sendNew = false) {
        if ((match.teamA.length >= 5 && match.teamB.length >= 5) || match.availablePlayerIds.length === 0) {
            return this.prepareVoting(interaction, match, !sendNew);
        }

        const currentTurnCaptain = match.pickTurn === 'A' ? match.captainA : match.captainB;
        const poolOptions = [];
        for (const pid of match.availablePlayerIds) {
            try {
                const p = await interaction.guild.members.fetch(pid);
                poolOptions.push({ label: p.displayName.substring(0, 25), value: p.id, emoji: '👤' });
            } catch (e) { }
        }

        const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('👥 Draft Aşaması')
            .setDescription(`**Sıra:** <@${currentTurnCaptain}> (Team ${match.pickTurn})`)
            .addFields(
                { name: `🔵 Team A (${match.teamA.length})`, value: match.teamA.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: `🔴 Team B (${match.teamB.length})`, value: match.teamB.map(id => `<@${id}>`).join('\n') || '-', inline: true },
                { name: '📍 Havuz', value: poolOptions.length > 0 ? poolOptions.map(p => p.label).join(', ') : 'Kimse kalmadı', inline: false }
            );

        const components = [];
        components.push(new ActionRowBuilder().addComponents(
            poolOptions.length > 0
                ? new StringSelectMenuBuilder().setCustomId(`match_pick_${match.matchId}`).setPlaceholder(`Oyuncu Seç (Team ${match.pickTurn})`).addOptions(poolOptions.slice(0, 25))
                : new ButtonBuilder().setCustomId(`match_enddraft_${match.matchId}`).setLabel('Seçimi Bitir').setStyle(ButtonStyle.Success)
        ));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_refresh_${match.matchId}`).setLabel('🔄 Yenile').setStyle(ButtonStyle.Secondary)));

        if (sendNew) {
            await interaction.channel.send({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
        } else {
            if (interaction.isMessageComponent()) await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
            else await interaction.update({ content: `Match ID: ${match.matchId}`, embeds: [embed], components: components });
        }
    },

    async handlePlayerPick(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const currentCap = match.pickTurn === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== currentCap) return interaction.reply({ content: 'Sıra sende değil!', ephemeral: true });

        const pickedId = interaction.values[0];
        if (match.pickTurn === 'A') { match.teamA.push(pickedId); match.pickTurn = 'B'; }
        else { match.teamB.push(pickedId); match.pickTurn = 'A'; }

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

    async prepareVoting(interaction, match, deleteMsg = true) {
        match.status = 'VOTING';
        match.voteStatus = 'VOTING';
        match.voteEndTime = new Date(Date.now() + 60000);
        await match.save();

        if (deleteMsg && interaction.message) {
            await interaction.message.delete().catch(() => { });
        }

        const embedInit = new EmbedBuilder().setColor(0x57F287).setTitle('🗳️ Oylama Odası Hazırlanıyor...').setDescription('Harita oylamasına geçiliyor.');
        const infoMsg = await interaction.channel.send({ embeds: [embedInit] });
        setTimeout(() => infoMsg.delete().catch(() => { }), 5000);

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;
        const allPlayers = [...match.teamA, ...match.teamB];

        const votingChannel = await guild.channels.create({
            name: `🗳️・map-voting`,
            type: ChannelType.GuildText,
            parent: MATCH_CATEGORY_ID,
            permissionOverwrites: [
                { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...allPlayers.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
            ]
        });

        match.createdChannelIds.push(votingChannel.id);
        match.channelId = votingChannel.id;
        await match.save();
        this.startMapVoting(votingChannel, match);
    },

    async startMapVoting(channel, match) {
        // TÜM HARİTALAR SUNULUYOR (Random 5 limitini kaldırdım)
        // Discord Menüsü max 25 alır, bizde 11 var. OK.
        const mapsToVote = MAPS;
        const endUnix = Math.floor(match.voteEndTime.getTime() / 1000);
        const totalPlayers = match.teamA.length + match.teamB.length;

        const embed = new EmbedBuilder().setColor(0xFFA500).setTitle('🗳️ Harita Oylaması')
            .setDescription(`Oynamak istediğiniz haritayı seçin!\n\n⏳ **Bitiş:** <t:${endUnix}:R>`)
            .addFields({ name: 'Aday Haritalar', value: mapsToVote.map(m => `• ${m.name}`).join('\n') })
            .setFooter({ text: `🗳️ Oy Durumu: 0/${totalPlayers}` });

        const options = mapsToVote.map(m => ({ label: m.name, value: m.name, emoji: '🗺️' }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`match_vote_${match.matchId}`).setPlaceholder('Haritanı Seç!').addOptions(options));

        await channel.send({ content: '@here', embeds: [embed], components: [row] });
        setTimeout(() => this.endVoting(channel, match.matchId), 60000);
    },

    async handleMapVote(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return interaction.reply({ content: 'Oylama aktif değil.', ephemeral: true });

        const selectedMap = interaction.values[0];
        const userId = interaction.user.id;

        match.votes = match.votes.filter(v => v.userId !== userId);
        match.votes.push({ userId, mapName: selectedMap });
        await match.save();
        await interaction.reply({ content: `✅ Oyunuz **${selectedMap}** için kaydedildi.`, ephemeral: true });

        // Erken Bitiş ve Sayaç Güncelleme
        const totalPlayers = match.teamA.length + match.teamB.length;

        try {
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.setFooter({ text: `🗳️ Oy Durumu: ${match.votes.length}/${totalPlayers}` });
            await interaction.message.edit({ embeds: [embed] });
        } catch (e) { }

        if (match.votes.length >= totalPlayers) {
            await interaction.channel.send('⚡ **Herkes oy kullandı! Oylama sonlandırılıyor...**');
            await this.endVoting(interaction.channel, match.matchId);
        }
    },

    async endVoting(channel, matchId) {
        const match = await Match.findOne({ matchId });
        if (!match || match.voteStatus !== 'VOTING') return;

        const counts = {};
        match.votes.forEach(v => { counts[v.mapName] = (counts[v.mapName] || 0) + 1; });
        const sortedMaps = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        if (sortedMaps.length === 0) {
            match.selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)].name;
            channel.send(`⚠️ Kimse oy kullanmadı. Rastgele: **${match.selectedMap}**`);
        } else {
            const topMap = sortedMaps[0];
            if (sortedMaps.length > 1 && sortedMaps[1][1] === topMap[1]) {
                channel.send(`⚖️ **Beraberlik!** Rastgele seçim yapılıyor...`);
                const tied = sortedMaps.filter(m => m[1] === topMap[1]);
                match.selectedMap = tied[Math.floor(Math.random() * tied.length)][0];
            } else { match.selectedMap = topMap[0]; }
            channel.send(`✅ **Kazanan:** **${match.selectedMap}** (${topMap[1]} oy)`);
        }

        match.voteStatus = 'FINISHED'; await match.save();
        this.startSideSelection(channel, match);
    },

    async startSideSelection(channel, match) {
        const winner = Math.random() < 0.5 ? 'A' : 'B';
        match.coinFlipWinner = winner; match.status = 'SIDE_SELECTION'; await match.save();
        const winnerId = winner === 'A' ? match.captainA : match.captainB;
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        const embed = new EmbedBuilder().setColor(0xFFD700).setTitle(`🏰 Harita: ${match.selectedMap}`).setDescription(`**Taraf Seçimi:** Team ${winner} (<@${winnerId}>)`).setImage(mapData ? mapData.img : null);
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
        if (interaction.user.id !== winnerId) return interaction.reply({ content: 'Sıra sende değil!', ephemeral: true });

        if (match.coinFlipWinner === 'A') { match.sideA = side; match.sideB = side === 'ATTACK' ? 'DEFEND' : 'ATTACK'; }
        else { match.sideB = side; match.sideA = side === 'ATTACK' ? 'DEFEND' : 'ATTACK'; }

        match.status = 'LIVE'; await match.save();
        await interaction.update({ components: [] });
        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async setupVoiceAndStart(guild, match, infoChannel) {
        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;
        const createPerms = (teamIds) => [
            { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))
        ];

        const voiceA = await guild.channels.create({ name: `🔵 Team A (${match.sideA})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
        const voiceB = await guild.channels.create({ name: `🔴 Team B (${match.sideB})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

        match.createdChannelIds.push(voiceA.id); match.createdChannelIds.push(voiceB.id); await match.save();

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        const panelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger));
        await infoChannel.send({ content: `✅ **MAÇ BAŞLADI!**`, components: [panelRow] });
    },

    async endMatch(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_A`).setLabel('🏆 Team A').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_B`).setLabel('🏆 Team B').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_winner_${matchId}_CANCEL`).setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: '🏁 Maç Sonucu?', components: [row], ephemeral: true });
    },

    async handleRandomMap(interaction) { return interaction.reply({ content: 'Oylama aktif!', ephemeral: true }); },

    async handleMatchResult(interaction) {
        const [_, __, matchId, winner] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });
        if (!match) return;
        await interaction.update({ content: '⏳ İşleniyor...', components: [] });

        if (winner !== 'CANCEL') {
            const betReport = await this.processBets(interaction.guild, match, winner);
            await this.generateResultCard(interaction.guild, match, winner, betReport);
        }
        await this.cleanupMatch(interaction.guild, match);
    },

    async generateResultCard(guild, match, winnerTeam, betReport = null) {
        try {
            let resultChannel = guild.channels.cache.find(c => c.name === 'maç-sonuçları');
            if (!resultChannel) resultChannel = await guild.channels.create({ name: 'maç-sonuçları', type: ChannelType.GuildText });
            const winningTeamIds = winnerTeam === 'A' ? match.teamA : match.teamB;
            const teamName = winnerTeam === 'A' ? 'TEAM A' : 'TEAM B';
            const color = winnerTeam === 'A' ? '#5865F2' : '#ED4245';

            const canvas = createCanvas(800, 450); const ctx = canvas.getContext('2d');
            const mapData = MAPS.find(m => m.name === match.selectedMap) || MAPS[0];
            try {
                const bg = await loadImage(mapData.img); ctx.drawImage(bg, 0, 0, 800, 450);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, 800, 450);
            } catch (e) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 800, 450); }

            ctx.textAlign = 'center'; ctx.font = '80px VALORANT'; ctx.fillStyle = color; ctx.fillText('VICTORY', 400, 100);
            ctx.font = '40px VALORANT'; ctx.fillStyle = 'white'; ctx.fillText(`${teamName} WON`, 400, 150);
            for (let i = 0; i < winningTeamIds.length; i++) {
                try {
                    const member = await guild.members.fetch(winningTeamIds[i]);
                    const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }));
                    const x = 100 + (i * 130); const y = 220;
                    ctx.save(); ctx.beginPath(); ctx.arc(x + 50, y + 50, 50, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, x, y, 100, 100); ctx.restore();
                    ctx.fillStyle = 'white'; ctx.font = '18px VALORANT'; ctx.fillText(member.displayName.substring(0, 10), x + 50, y + 130);
                } catch (e) { }
            }
            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'match-result.png' });
            const embed = new EmbedBuilder().setColor(color).setImage('attachment://match-result.png').setDescription(`**Kazanan:** ${teamName}\n**Harita:** ${match.selectedMap}`);
            if (betReport) embed.addFields({ name: 'Bahis', value: betReport });
            await resultChannel.send({ embeds: [embed], files: [attachment] });
        } catch (e) { console.error(e); }
    },

    async processBets(guild, match, winnerTeam) {
        if (!match.bets) return null;
        let winners = [];
        for (const bet of match.bets) {
            if (bet.team === winnerTeam && !bet.claimed) {
                const winAmount = bet.amount * 2;
                const user = await User.findOne({ odasi: bet.userId, odaId: guild.id });
                if (user) { user.balance += winAmount; await user.save(); winners.push(`<@${bet.userId}> (+${winAmount})`); bet.claimed = true; }
            }
        }
        await match.save();
        return winners.length ? `💰 **Kazananlar:** ${winners.join(', ')}` : null;
    },

    async cleanupMatch(guild, match) {
        if (match.lobbyVoiceId) {
            const allPlayers = [...match.teamA, ...match.teamB];
            for (const id of allPlayers) try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(match.lobbyVoiceId); } catch (e) { }
        }
        setTimeout(async () => {
            for (const cid of match.createdChannelIds) try { guild.channels.cache.get(cid)?.delete(); } catch (e) { }
            match.status = 'FINISHED'; await match.save();
        }, 3000);
    },

    async checkTimeouts(client) {
        const TIMEOUT_MS = 5 * 60 * 1000;
        const matches = await Match.find({ status: { $in: ['SETUP', 'DRAFT', 'VOTING', 'SIDE_SELECTION'] }, updatedAt: { $lt: new Date(Date.now() - TIMEOUT_MS) } });
        for (const match of matches) {
            match.status = 'CANCELLED'; await match.save();
            const guild = client.guilds.cache.get(match.guildId);
            if (guild && match.createdChannelIds) for (const cid of match.createdChannelIds) try { guild.channels.cache.get(cid)?.delete(); } catch (e) { }
        }
    }
};
