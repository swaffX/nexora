const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, AttachmentBuilder
} = require('discord.js');
const path = require('path');

const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS, getCategoryId } = require('./constants');
const manager = require('./manager');

module.exports = {
    async startSideSelection(channel, match) {
        // Coinflip Aşamasını Başlat
        match.status = 'COIN_FLIP';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🪙 Yazı Tura (Coinflip)')
            .setDescription(`**Team A Kaptanı** (<@${match.captainA}>), seçimini yap!\nKazanan taraf seçme hakkını elde eder.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_coin_HEADS_${match.matchId}`).setLabel('Yazı').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
            new ButtonBuilder().setCustomId(`match_coin_TAILS_${match.matchId}`).setLabel('Tura').setStyle(ButtonStyle.Secondary).setEmoji('🦅')
        );

        await channel.send({ content: `<@${match.captainA}>`, embeds: [embed], components: [row] });
    },

    async handleCoinFlip(interaction) {
        const [_, __, choice, matchId] = interaction.customId.split('_'); // match_coin_HEADS_123
        const match = await Match.findOne({ matchId });
        if (!match) return;

        const { MessageFlags } = require('discord.js');
        if (interaction.user.id !== match.captainA) return interaction.reply({ content: 'Sadece Team A Kaptanı seçebilir.', flags: MessageFlags.Ephemeral });

        await interaction.deferUpdate();

        // Sonucu Belirle
        const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
        const win = (choice === result);

        // Kazanan Kim?
        // Eğer A bildiyse -> A kazanır.
        // Bilemediyse -> B kazanır.
        const winnerTeam = win ? 'A' : 'B';
        match.coinFlipWinner = winnerTeam;
        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;

        // Animasyonlu Mesaj (3 saniye gecikmeli gibi yapabiliriz ama Discord API izin vermez, direkt sonucu atalım)
        const resultEmbed = new EmbedBuilder()
            .setColor(win ? 0x00FF00 : 0xFF0000)
            .setTitle(`🪙 Sonuç: ${result === 'HEADS' ? 'YAZI' : 'TURA'}!`)
            .setDescription(`**${choice === 'HEADS' ? 'Yazı' : 'Tura'}** seçildi.\n\n🎉 **Kazanan:** Team ${winnerTeam} (<@${winnerId}>)\nTaraf seçme hakkı kazandınız!`);

        await interaction.editReply({ components: [] });
        await interaction.channel.send({ embeds: [resultEmbed] });

        // Taraf Seçimine Geç
        setTimeout(() => this.showSidePicker(interaction.channel, match, winnerTeam), 2000);
    },

    async showSidePicker(channel, match, winnerTeam) {
        match.status = 'SIDE_SELECTION';
        await match.save();

        const winnerId = winnerTeam === 'A' ? match.captainA : match.captainB;
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`🏰 Harita: ${match.selectedMap}`)
            .setDescription(`**Taraf Seçimi:** Team ${winnerTeam} (<@${winnerId}>)\nLütfen başlamak istediğiniz tarafı seçin.`)
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
        if (!match) return;

        const { MessageFlags } = require('discord.js');
        const winnerId = match.coinFlipWinner === 'A' ? match.captainA : match.captainB;
        if (interaction.user.id !== winnerId) return interaction.reply({ content: 'Sıra sende değil!', flags: MessageFlags.Ephemeral });

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
        const MATCH_CATEGORY_ID = getCategoryId();
        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;

        const createPerms = (teamIds) => [
            { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }))
        ];

        const captainA = await guild.members.fetch(match.captainA).catch(() => ({ displayName: 'PLAYER A' }));
        const captainB = await guild.members.fetch(match.captainB).catch(() => ({ displayName: 'PLAYER B' }));

        const nameA = `TEAM ${captainA.displayName.toUpperCase()}`;
        const nameB = `TEAM ${captainB.displayName.toUpperCase()}`;

        const voiceA = await guild.channels.create({ name: `🔵 ${nameA} (${match.sideA})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
        const voiceB = await guild.channels.create({ name: `🔴 ${nameB} (${match.sideB})`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

        match.createdChannelIds.push(voiceA.id);
        match.createdChannelIds.push(voiceB.id);
        await match.save();

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        const panelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger));

        const payload = {
            content: `✅ **MAÇ BAŞLADI!**\n🏰 Harita: **${match.selectedMap}**\n⚔️ Taraf: **${nameA} (${match.sideA}) vs ${nameB} (${match.sideB})**`,
            components: [panelRow]
        };

        await infoChannel.send(payload);
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
        const { MessageFlags } = require('discord.js');
        await interaction.reply({ content: '🏁 Maç Sonucu?', components: [row], flags: MessageFlags.Ephemeral });
    },

    async handleMatchResult(interaction) {
        const [_, __, matchId, winner] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (winner === 'CANCEL') {
            await interaction.update({ content: '⏳ İptal ediliyor...', components: [] });
            await manager.forceEndMatch(interaction.guild, match.matchId, 'Maç sonucu girilirken iptal edildi.');
            const { MessageFlags } = require('discord.js');
            await interaction.followUp({ content: '✅ Maç iptal edildi ve kanallar silindi.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Kazananı kaydet
        match.winnerTeam = winner;
        match.status = 'FINISHED';
        await match.save();

        await interaction.update({ content: '⏳ İşleniyor...', components: [] });

        // Bahisleri işle
        const betReport = await this.processBets(interaction.guild, match, winner);

        // KDA Giriş Paneli Göster
        await this.showKDAPanel(interaction.channel, match, betReport);
    },

    // KDA Giriş Paneli
    async showKDAPanel(channel, match, betReport) {
        const guild = channel.guild;
        const allPlayers = [...match.teamA, ...match.teamB];

        // Oyuncuları başlangıç değerleriyle initialize et
        match.playerStats = allPlayers.map(pid => ({
            odasi: pid,
            kills: 0,
            deaths: 0,
            assists: 0
        }));
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('📊 Skor Tablosu Girişi')
            .setDescription('Her oyuncunun KDA skorlarını girmek için aşağıdaki butonları kullanın.\n\n**Format:** Kills / Deaths / Assists')
            .addFields(
                { name: '🔵 Team A', value: match.teamA.map(id => `<@${id}>: -/-/-`).join('\n'), inline: true },
                { name: '🔴 Team B', value: match.teamB.map(id => `<@${id}>: -/-/-`).join('\n'), inline: true }
            );

        // Oyuncu isimlerini al
        const playerNames = {};
        for (const pid of allPlayers) {
            try {
                const member = await guild.members.fetch(pid).catch(() => null);
                playerNames[pid] = member?.displayName?.substring(0, 20) || `Oyuncu`;
            } catch (e) {
                playerNames[pid] = 'Oyuncu';
            }
        }

        // Team A butonları
        const teamARows = [];
        for (let i = 0; i < match.teamA.length; i += 5) {
            const chunk = match.teamA.slice(i, i + 5);
            const row = new ActionRowBuilder();
            for (const pid of chunk) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_kda_${match.matchId}_${pid}`)
                        .setLabel(`🔵 ${playerNames[pid]}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
            teamARows.push(row);
        }

        // Team B butonları
        const teamBRows = [];
        for (let i = 0; i < match.teamB.length; i += 5) {
            const chunk = match.teamB.slice(i, i + 5);
            const row = new ActionRowBuilder();
            for (const pid of chunk) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_kda_${match.matchId}_${pid}`)
                        .setLabel(`🔴 ${playerNames[pid]}`)
                        .setStyle(ButtonStyle.Danger)
                );
            }
            teamBRows.push(row);
        }

        // Tüm satırları birleştir
        const rows = [...teamARows, ...teamBRows];

        // Bitir butonu
        const finishRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`match_finishkda_${match.matchId}`)
                .setLabel('✅ Skorları Kaydet ve Bitir')
                .setStyle(ButtonStyle.Success)
        );
        rows.push(finishRow);

        // betReport'u kaydet
        match.betReport = betReport;
        await match.save();

        await channel.send({ embeds: [embed], components: rows });
    },

    // KDA Modal Göster
    async showKDAModal(interaction) {
        const parts = interaction.customId.split('_');
        const matchId = parts[2];
        const odasi = parts[3];

        // Oyuncu ismini al
        let playerName = 'Oyuncu';
        try {
            const member = await interaction.guild.members.fetch(odasi).catch(() => null);
            playerName = member?.displayName?.substring(0, 20) || 'Oyuncu';
        } catch (e) { }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`modal_kda_${matchId}_${odasi}`)
            .setTitle(`📊 ${playerName} - KDA`);

        const killsInput = new TextInputBuilder()
            .setCustomId('kills')
            .setLabel('Kills (Öldürme)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 15')
            .setRequired(true);

        const deathsInput = new TextInputBuilder()
            .setCustomId('deaths')
            .setLabel('Deaths (Ölme)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 8')
            .setRequired(true);

        const assistsInput = new TextInputBuilder()
            .setCustomId('assists')
            .setLabel('Assists (Asist)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 5')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(killsInput),
            new ActionRowBuilder().addComponents(deathsInput),
            new ActionRowBuilder().addComponents(assistsInput)
        );

        await interaction.showModal(modal);
    },

    // KDA Modal Submit
    async handleKDASubmit(interaction) {
        const parts = interaction.customId.split('_');
        const matchId = parts[2];
        const odasi = parts[3];

        const kills = parseInt(interaction.fields.getTextInputValue('kills')) || 0;
        const deaths = parseInt(interaction.fields.getTextInputValue('deaths')) || 0;
        const assists = parseInt(interaction.fields.getTextInputValue('assists')) || 0;

        const match = await Match.findOne({ matchId });
        if (!match) return;

        // Güncelle
        const statIndex = match.playerStats.findIndex(s => s.odasi === odasi);
        if (statIndex !== -1) {
            match.playerStats[statIndex].kills = kills;
            match.playerStats[statIndex].deaths = deaths;
            match.playerStats[statIndex].assists = assists;
        }
        await match.save();

        const { MessageFlags } = require('discord.js');
        await interaction.reply({
            content: `✅ <@${odasi}> için skor kaydedildi: **${kills}/${deaths}/${assists}**`,
            flags: MessageFlags.Ephemeral
        });
    },

    // KDA Bitir ve Sonuç Göster
    async finishKDA(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        await interaction.update({ content: '⏳ Skor tablosu oluşturuluyor...', components: [] });

        // Sonuç kartını oluştur
        await this.generateResultCard(interaction.guild, match, match.winnerTeam, match.betReport);

        // Cleanup
        await manager.cleanupMatchChannels(interaction.guild, match);
    },

    async generateResultCard(guild, match, winnerTeam, betReport = null) {
        try {
            let resultChannel = guild.channels.cache.find(c => c.name === 'maç-sonuçları');
            if (!resultChannel) resultChannel = await guild.channels.create({ name: 'maç-sonuçları', type: ChannelType.GuildText });

            const teamName = winnerTeam === 'A' ? 'TEAM A 🔵' : 'TEAM B 🔴';
            const color = winnerTeam === 'A' ? 0x5865F2 : 0xED4245;

            // KDA skorlarını formatla (Valorant tarzı tablo)
            const formatStats = (playerId) => {
                const stat = match.playerStats?.find(s => s.odasi === playerId);
                if (!stat) return '0/0/0';
                return `${stat.kills}/${stat.deaths}/${stat.assists}`;
            };

            // Her takım için oyuncuları kills'e göre sırala
            const sortByKills = (playerIds) => {
                return playerIds.sort((a, b) => {
                    const statA = match.playerStats?.find(s => s.odasi === a);
                    const statB = match.playerStats?.find(s => s.odasi === b);
                    return (statB?.kills || 0) - (statA?.kills || 0);
                });
            };

            const teamASorted = sortByKills([...match.teamA]);
            const teamBSorted = sortByKills([...match.teamB]);

            // Skor tablosu stringi oluştur
            const buildScoreboard = (players, teamEmoji) => {
                if (!players.length) return 'Oyuncu yok';
                return players.map((id, idx) => {
                    const kda = formatStats(id);
                    const mvpBadge = idx === 0 ? '⭐' : '';
                    return `${mvpBadge}<@${id}> — **${kda}**`;
                }).join('\n');
            };

            // Toplam takım istatistikleri
            const calcTeamTotals = (players) => {
                let kills = 0, deaths = 0, assists = 0;
                players.forEach(id => {
                    const stat = match.playerStats?.find(s => s.odasi === id);
                    if (stat) {
                        kills += stat.kills || 0;
                        deaths += stat.deaths || 0;
                        assists += stat.assists || 0;
                    }
                });
                return { kills, deaths, assists };
            };

            const teamATotals = calcTeamTotals(match.teamA);
            const teamBTotals = calcTeamTotals(match.teamB);

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: '🎮 MAÇ SONUCU' })
                .setTitle(`🏆 KAZANAN: ${teamName}`)
                .setDescription(`**🗺️ Harita:** ${match.selectedMap}\n**📅 Tarih:** <t:${Math.floor(Date.now() / 1000)}:f>`)
                .addFields(
                    {
                        name: `🔵 TEAM A (${teamATotals.kills}/${teamATotals.deaths}/${teamATotals.assists})`,
                        value: buildScoreboard(teamASorted, '🔵'),
                        inline: true
                    },
                    {
                        name: `🔴 TEAM B (${teamBTotals.kills}/${teamBTotals.deaths}/${teamBTotals.assists})`,
                        value: buildScoreboard(teamBSorted, '🔴'),
                        inline: true
                    }
                )
                .setFooter({ text: '⭐ = MVP (En Çok Kill)' })
                .setTimestamp();

            if (betReport) embed.addFields({ name: '💰 Bahis Sonuçları', value: betReport, inline: false });

            await resultChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Result Card Error:', e); }
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
    }
};
