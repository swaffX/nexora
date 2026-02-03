const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, AttachmentBuilder, MessageFlags
} = require('discord.js');
const path = require('path');

const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { MAPS } = require('./constants');
const manager = require('./manager');

module.exports = {
    async startSideSelection(channel, match) {
        // Coinflip Aşamasını Başlat
        match.status = 'COIN_FLIP';
        await match.save();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F) // Gold
            .setTitle('🪙 YAZI TURA ZAMANI')
            .setDescription(`**Kaptan'ın Kararı Bekleniyor!**\n\n<@${match.captainA}>, parayı havaya at!\nKazanan taraf, harita tarafını (Attack/Defend) seçer.`)
            .setThumbnail('https://media.tenor.com/T0T_vO3h6kEAAAAi/coin-flip-coin.gif') // Ufak bir spin animasyonu
            .addFields({ name: '🎮 VALORANT Lobi Kodu', value: match.lobbyCode ? `\`\`\`${match.lobbyCode}\`\`\`` : 'Bekleniyor...', inline: false })
            .setFooter({ text: 'Nexora Coin System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_coin_HEADS_${match.matchId}`).setLabel('Yazı').setStyle(ButtonStyle.Secondary).setEmoji('1467551334621253866'),
            new ButtonBuilder().setCustomId(`match_coin_TAILS_${match.matchId}`).setLabel('Tura').setStyle(ButtonStyle.Secondary).setEmoji('1467551298327937044'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@${match.captainA}>`, embeds: [embed], components: [row] });
    },

    async handleCoinFlip(interaction) {
        const [_, __, choice, matchId] = interaction.customId.split('_'); // match_coin_HEADS_123
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (interaction.user.id !== match.captainA) return interaction.reply({ content: 'Sadece Team A Kaptanı seçebilir.', flags: MessageFlags.Ephemeral });

        await interaction.update({ components: [] }); // Butonları sil

        // 1. ANIMASYON
        const spinEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('💫 Para Dönüyor...')
            .setDescription(`**${choice === 'HEADS' ? 'Yazı' : 'Tura'}** seçildi. Şans seninle olsun!`)
            .setImage('https://media.tenor.com/On7kvXhzml4AAAAi/loading-gif.gif');

        await interaction.message.edit({ embeds: [spinEmbed], components: [] });

        setTimeout(async () => {
            try {
                const currentMatch = await Match.findOne({ matchId });
                if (!currentMatch) return;

                const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
                const win = (choice === result);
                const winnerTeam = win ? 'A' : 'B';

                currentMatch.coinFlipWinner = winnerTeam;
                await currentMatch.save();

                const winnerId = winnerTeam === 'A' ? currentMatch.captainA : currentMatch.captainB;
                const resultImage = result === 'HEADS'
                    ? 'https://cdn.discordapp.com/emojis/1467551334621253866.png'
                    : 'https://cdn.discordapp.com/emojis/1467551298327937044.png';

                const resultEmbed = new EmbedBuilder()
                    .setColor(win ? 0x2ECC71 : 0xE74C3C)
                    .setTitle(`🪙 SONUÇ: ${result === 'HEADS' ? 'YAZI' : 'TURA'}!`)
                    .setDescription(`**Kazanan:** Team ${winnerTeam} (<@${winnerId}>)\n\nSeçim yapma hakkı kazandınız!`)
                    .setThumbnail(resultImage);

                await interaction.message.edit({ embeds: [resultEmbed] }).catch(() => { });

                setTimeout(async () => {
                    await interaction.message.delete().catch(() => { });
                    this.showSidePicker(interaction.channel, currentMatch, winnerTeam);
                }, 4000);

            } catch (error) {
                console.error('Coinflip Animation Error:', error);
            }
        }, 3000);
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
            .setFooter({ text: 'Made by Swaff' });

        const files = [];
        if (mapData && mapData.file) {
            try {
                const filePath = path.join(__dirname, '..', '..', '..', 'assets', 'maps', mapData.file);
                const attachment = new AttachmentBuilder(filePath);
                embed.setImage(`attachment://${mapData.file}`);
                files.push(attachment);
            } catch (e) { console.error('Map image error:', e); }
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_ATTACK`).setLabel('🗡️ Attack').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_DEFEND`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row], files: files });
    },

    async handleSidePick(interaction) {
        const [_, __, matchId, side] = interaction.customId.split('_');
        const match = await Match.findOne({ matchId });
        if (!match) return;

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
        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => { });
        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async setupVoiceAndStart(guild, match, infoChannel) {
        const { LOBBY_CONFIG } = require('./constants');
        let MATCH_CATEGORY_ID;

        if (match.lobbyVoiceId) {
            const config = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
            if (config) MATCH_CATEGORY_ID = config.categoryId;
        }
        if (!MATCH_CATEGORY_ID) MATCH_CATEGORY_ID = LOBBY_CONFIG[1].categoryId;

        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;

        const createPerms = (teamIds) => [
            { id: everyone.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages] },
            ...teamIds.map(id => ({ id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.Stream, PermissionsBitField.Flags.UseVAD] }))
        ];

        const captainA = await guild.members.fetch(match.captainA).catch(() => ({ displayName: 'PLAYER A' }));
        const captainB = await guild.members.fetch(match.captainB).catch(() => ({ displayName: 'PLAYER B' }));

        const nameA = `TEAM ${captainA.displayName.toUpperCase()}`;
        const nameB = `TEAM ${captainB.displayName.toUpperCase()}`;
        const channelNameA = `🔵 ${nameA} (${match.sideA})`;
        const channelNameB = `🔴 ${nameB} (${match.sideB})`;

        let voiceA, voiceB;
        const existingVoiceIds = match.createdChannelIds.filter(id => {
            const c = guild.channels.cache.get(id);
            return c && c.type === ChannelType.GuildVoice;
        });

        if (existingVoiceIds.length >= 2) {
            voiceA = guild.channels.cache.get(existingVoiceIds[0]);
            voiceB = guild.channels.cache.get(existingVoiceIds[1]);
            if (voiceA) { await voiceA.setName(channelNameA).catch(() => { }); await voiceA.permissionOverwrites.set(createPerms(match.teamA)).catch(() => { }); }
            if (voiceB) { await voiceB.setName(channelNameB).catch(() => { }); await voiceB.permissionOverwrites.set(createPerms(match.teamB)).catch(() => { }); }
        } else {
            voiceA = await guild.channels.create({ name: channelNameA, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
            voiceB = await guild.channels.create({ name: channelNameB, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });
            match.createdChannelIds.push(voiceA.id);
            match.createdChannelIds.push(voiceB.id);
            await match.save();
        }

        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel && m.voice.channelId !== cid) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        if (match.draftMessageId) {
            try {
                const draftMsg = await infoChannel.messages.fetch(match.draftMessageId).catch(() => null);
                if (draftMsg) await draftMsg.delete().catch(() => { });
                match.draftMessageId = null;
                await match.save();
            } catch (e) { }
        }

        const panelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger)
        );

        const mapData = MAPS.find(m => m.name === match.selectedMap);
        const divider = '<a:ayrma:1468003499072688309>'.repeat(5);
        const listA = `${divider}\n${match.teamA.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok'}`;
        const listB = `${divider}\n${match.teamB.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok'}`;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle(`🔴 MAÇ BAŞLADI! (LIVE)`)
            .setDescription(`## 🗺️ Harita: **${match.selectedMap.toUpperCase()}** ${divider}`)
            .addFields(
                { name: '🎮 VALORANT Lobi Kodu', value: `\`\`\`${match.lobbyCode || 'BEKLENİYOR'}\`\`\``, inline: false },
                { name: `🔹 ${nameA} (${match.sideA === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND'})`, value: listA, inline: true },
                { name: `🔸 ${nameB} (${match.sideB === 'ATTACK' ? '🗡️ ATTACK' : '🛡️ DEFEND'})`, value: listB, inline: true }
            )
            .setFooter({ text: 'Maç devam ediyor... İyi şanslar! • Made by Swaff' })
            .setTimestamp();

        const files = [];
        if (mapData && mapData.file) {
            try {
                const filePath = path.join(__dirname, '..', '..', '..', 'assets', 'maps', mapData.file);
                const attachment = new AttachmentBuilder(filePath);
                embed.setImage(`attachment://${mapData.file}`);
                files.push(attachment);
            } catch (e) { }
        }
        await infoChannel.send({ embeds: [embed], components: [panelRow], files: files });
    },

    async endMatch(interaction) {
        if (!interaction.isMessageComponent()) return;

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        if (match.status === 'FINISHING' || match.status === 'FINISHED') {
            return interaction.reply({ content: '⚠️ Bu maç zaten sonlandırılıyor.', flags: MessageFlags.Ephemeral });
        }

        // 1. Durumu Kilitle
        match.status = 'FINISHING';
        await match.save();

        await interaction.reply({ content: '🏁 **Maç Sonlandırılıyor...**\nSes kanalları siliniyor ve oyuncular taşınıyor.', flags: MessageFlags.Ephemeral });

        // 2. LOBİ TEMİZLİĞİ (Hemen)
        try {
            await manager.forceEndMatch(interaction.guild, matchId, 'Maç Bitir butonu ile sonlandırıldı.');
            await manager.cleanupVoiceChannels(interaction.guild, match);
        } catch (e) {
            console.error('Cleanup Error:', e);
        }

        // 3. SKOR BUTONU
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_enterscore_${matchId}`).setLabel('Skor Gir & Bitir').setStyle(ButtonStyle.Success).setEmoji('📝')
        );

        await interaction.channel.send({
            content: `✅ **Lobi ses kanalları temizlendi.**\n\nYetkili, lütfen maç sonucunu işlemek için aşağıdaki butona basıp skoru girin.`,
            components: [row]
        });
    },

    async showScoreModal(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`modal_score_${matchId}`)
            .setTitle('Maç Sonucu & Skor');

        const scoreA = new TextInputBuilder()
            .setCustomId('score_a')
            .setLabel('Team A Skoru')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 13')
            .setMaxLength(2)
            .setRequired(true);

        const scoreB = new TextInputBuilder()
            .setCustomId('score_b')
            .setLabel('Team B Skoru')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Örn: 9')
            .setMaxLength(2)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(scoreA), new ActionRowBuilder().addComponents(scoreB));
        await interaction.showModal(modal);
    },

    async handleScoreSubmit(interaction) {
        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return interaction.reply({ content: 'Maç bulunamadı.', flags: MessageFlags.Ephemeral });

        const scoreA = interaction.fields.getTextInputValue('score_a');
        const scoreB = interaction.fields.getTextInputValue('score_b');

        match.scoreA = scoreA;
        match.scoreB = scoreB;
        await match.save();

        await interaction.reply({
            content: `✅ Skorlar alındı: **${scoreA} - ${scoreB}**`,
            flags: MessageFlags.Ephemeral
        });

        // Butonları temizle
        await interaction.message.edit({ components: [] }).catch(() => { });

        // SS İste
        await interaction.channel.send({ content: `� <@${interaction.user.id}> **Lütfen Skor Tablosunun Ekran Görüntüsünü (SS) bu kanala yükleyin.**\nSS yüklendiği an işlem tamamlanacak ve bu kanal silinecektir.` });
    },

    async completeMatchWithEvidence(message, match) {
        // Final Durum
        match.status = 'FINISHED';
        match.evidenceUrl = message.attachments.first().url;
        if (!match.playedMaps.includes(match.selectedMap)) match.playedMaps.push(match.selectedMap);
        await match.save();

        message.channel.send('✅ **Veriler işlendi!** Kanal kapatılıyor...');

        const LOG_CHANNEL_ID = '1468318739278729472';
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

        if (logChannel) {
            const date = new Date().toLocaleDateString('tr-TR');
            const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const { LOBBY_CONFIG } = require('./constants');
            const lobbyConfig = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
            const lobbyName = lobbyConfig ? lobbyConfig.name : 'Unknown Lobby';

            const historyEmbed = new EmbedBuilder()
                .setColor(0x2F3136)
                .setAuthor({ name: `Maç Özeti • #${match.matchNumber}`, iconURL: message.guild.iconURL() })
                .setDescription(`**Bitiş Nedeni:** Maç Bitir butonu ile sonlandırıldı.\nKısa süre önce sonlandırıldı.`)
                .addFields(
                    { name: '🗺️ Oynanan Harita', value: match.selectedMap || 'Bilinmiyor', inline: true },
                    { name: '📍 Lobi', value: lobbyName, inline: true },
                    { name: '⏱️ Oynanış Süresi', value: `${date}`, inline: true },
                    { name: '👑 Oluşturan', value: `<@${match.hostId}>`, inline: true },
                    { name: '📆 Tarih', value: `${date}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: `🔵 DEFEND`, value: match.teamA.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false },
                    { name: `🔴 ATTACK`, value: match.teamB.map(id => `<@${id}>`).join(', ') || 'Yok', inline: false }
                )
                .setImage(match.evidenceUrl)
                .setFooter({ text: `Nexora Competitive • Match ID: ${match.matchId} • ${date} ${time}` });

            await logChannel.send({ embeds: [historyEmbed] });
        }

        // Skorları Bahis İçin Kullan (Eğer varsa)
        // Burada processBets çağrılabilir ama şimdilik pas geçiyorum kullanıcı özel istemedi.

        // SADECE Metin Kanalını Sil (Ses zaten silindi)
        setTimeout(() => {
            if (message.channel) message.channel.delete().catch(() => { });
        }, 3000);
    },

    async processBets(guild, match, winnerTeam) {
        if (!match.bets) return null;
        for (const bet of match.bets) {
            if (bet.team === winnerTeam && !bet.claimed) {
                const user = await User.findOne({ odasi: bet.userId, odaId: guild.id });
                if (user) { user.balance += winAmount; await user.save(); bet.claimed = true; }
            }
        }
        await match.save();
    },

    async showNextMatchOptions(channel, match) {
        // ... (Bu fonksiyon silinebilir veya bırakılabilir, şu an kullanılmıyor yeni akışta)
        // Hata vermemesi için boş bırakıyorum veya eski kod kalabilir.
    }
};
