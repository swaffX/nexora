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
            new ButtonBuilder().setCustomId(`match_coin_TAILS_${match.matchId}`).setLabel('Tura').setStyle(ButtonStyle.Secondary).setEmoji('🦅'),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
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
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_DEFEND`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
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
        const channelNameA = `🔵 ${nameA} (${match.sideA})`;
        const channelNameB = `🔴 ${nameB} (${match.sideB})`;

        let voiceA, voiceB;
        let createdNew = false;

        // Var olan kanalları kontrol et (createdChannelIds içinde voice kanalı var mı?)
        // createdChannelIds[0] genelde text kanalıdır, diğerleri voice olabilir.
        // Ancak biz sadece ID listesine bakıp type kontrolü yapacağız.
        const existingVoiceIds = match.createdChannelIds.filter(id => {
            const c = guild.channels.cache.get(id);
            return c && c.type === ChannelType.GuildVoice;
        });

        if (existingVoiceIds.length >= 2) {
            // VAR OLAN KANALLARI GÜNCELLE
            voiceA = guild.channels.cache.get(existingVoiceIds[0]);
            voiceB = guild.channels.cache.get(existingVoiceIds[1]);

            if (voiceA) {
                await voiceA.setName(channelNameA).catch(() => { });
                await voiceA.permissionOverwrites.set(createPerms(match.teamA)).catch(() => { });
            }
            if (voiceB) {
                await voiceB.setName(channelNameB).catch(() => { });
                await voiceB.permissionOverwrites.set(createPerms(match.teamB)).catch(() => { });
            }
        } else {
            // YENİ KANAL OLUŞTUR
            createdNew = true;
            voiceA = await guild.channels.create({ name: channelNameA, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamA) });
            voiceB = await guild.channels.create({ name: channelNameB, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: createPerms(match.teamB) });

            match.createdChannelIds.push(voiceA.id);
            match.createdChannelIds.push(voiceB.id);
            await match.save();
        }

        // Oyuncuları Taşı
        const move = async (id, cid) => { try { const m = await guild.members.fetch(id); if (m.voice.channel && m.voice.channelId !== cid) await m.voice.setChannel(cid); } catch (e) { } };
        await Promise.all([...match.teamA.map(id => move(id, voiceA.id)), ...match.teamB.map(id => move(id, voiceB.id))]);

        const panelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_endlobby_${match.matchId}`).setLabel('❌ Lobiyi Bitir (Kapat)').setStyle(ButtonStyle.Secondary)
        );

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

        // Maçı Bitir (Kazanan sormadan)
        match.status = 'FINISHED';

        // Oynanan haritayı kaydet
        match.playedMaps.push(match.selectedMap);
        await match.save();

        const { MessageFlags } = require('discord.js');
        await interaction.reply({ content: '🏁 Maç sona erdi. Seçenekler yükleniyor...', flags: MessageFlags.Ephemeral });

        // Yeni Kontrol Panelini Göster
        await this.showNextMatchOptions(interaction.channel, match);
    },

    async showNextMatchOptions(channel, match) {
        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle('🏁 Maç Sonu Yönetimi')
            .setDescription(`**Bu lobiyle ne yapmak istersiniz?**\n\n🔁 **Takımlar Aynı:** Kaptanlar ve takımlar değişmeden yeni harita seçimine geçer.\n🔄 **Takımları Değiştir:** Takımları sıfırlar, kaptan seçimine döner.\n🛑 **Lobiyi Bitir:** Her şeyi siler ve kapatır.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_rematch_${match.matchId}`).setLabel('Takımlar Aynı (Devam)').setStyle(ButtonStyle.Success).setEmoji('🔁'),
            new ButtonBuilder().setCustomId(`match_reset_${match.matchId}`).setLabel('Takımları Değiştir').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId(`match_endlobby_${match.matchId}`).setLabel('Lobiyi Bitir').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );

        await channel.send({ embeds: [embed], components: [row] });
    },

    async processBets(guild, match, winnerTeam) {
        if (!match.bets) return null;
        for (const bet of match.bets) {
            if (bet.team === winnerTeam && !bet.claimed) {
                const winAmount = bet.amount * 2;
                const user = await User.findOne({ odasi: bet.userId, odaId: guild.id });
                if (user) { user.balance += winAmount; await user.save(); bet.claimed = true; }
            }
        }
        await match.save();
    }
};
