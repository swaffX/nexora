const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ChannelType, PermissionsBitField, AttachmentBuilder
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

        const { MessageFlags } = require('discord.js');
        if (interaction.user.id !== match.captainA) return interaction.reply({ content: 'Sadece Team A Kaptanı seçebilir.', flags: MessageFlags.Ephemeral });

        // İşlemi kabul et (Button loading state'e geçer)
        await interaction.update({ components: [] }); // Butonları sil (animasyon sırasında basılmasın)

        // 1. ANIMASYON (Dönen Para)
        const spinEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('💫 Para Dönüyor...')
            .setDescription(`**${choice === 'HEADS' ? 'Yazı' : 'Tura'}** seçildi. Şans seninle olsun!`)
            .setImage('https://media.tenor.com/On7kvXhzml4AAAAi/loading-gif.gif'); // Daha kaliteli bir spin GIF'i

        await interaction.message.edit({ embeds: [spinEmbed], components: [] });

        // 3 Saniye Bekle
        setTimeout(async () => {
            try {
                // Maç halen var mı kontrol et (Silindiyse işlem yapma)
                const currentMatch = await Match.findOne({ matchId });
                if (!currentMatch) return;

                // Sonucu Belirle
                const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
                const win = (choice === result);
                const winnerTeam = win ? 'A' : 'B';

                // match nesnesini güncelle (yukarıdaki 'match' referansı eski kalmış olabilir ama ID aynı)
                currentMatch.coinFlipWinner = winnerTeam;
                await currentMatch.save();

                const winnerId = winnerTeam === 'A' ? currentMatch.captainA : currentMatch.captainB;

                // Kazanılan Emojinin Resmi
                const resultImage = result === 'HEADS'
                    ? 'https://cdn.discordapp.com/emojis/1467551334621253866.png' // Yazı
                    : 'https://cdn.discordapp.com/emojis/1467551298327937044.png'; // Tura

                const resultEmbed = new EmbedBuilder()
                    .setColor(win ? 0x2ECC71 : 0xE74C3C)
                    .setTitle(`🪙 SONUÇ: ${result === 'HEADS' ? 'YAZI' : 'TURA'}!`)
                    .setDescription(`**Kazanan:** Team ${winnerTeam} (<@${winnerId}>)\n\nSeçim yapma hakkı kazandınız!`)
                    .setThumbnail(resultImage);

                await interaction.message.edit({ embeds: [resultEmbed] }).catch(() => { });

                // 4 Saniye sonra sil ve Taraf Seçimine geç
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
            } catch (e) {
                console.error('Map image load error:', e);
            }
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_ATTACK`).setLabel('🗡️ Attack').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`match_sidepick_${match.matchId}_DEFEND`).setLabel('🛡️ Defend').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`match_cancel_${match.matchId}`).setLabel('İptal').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );

        // Content (Etiket) kaldırıldı
        await channel.send({ embeds: [embed], components: [row], files: files });
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

        // Paneli Sil (Taraf Seçimi Paneli)
        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => { });

        await this.setupVoiceAndStart(interaction.guild, match, interaction.channel);
    },

    async setupVoiceAndStart(guild, match, infoChannel) {
        const { getLobbyConfig, LOBBY_CONFIG, getCategoryId } = require('./constants');

        // Kategori ID'yi dinamik olarak bul
        let MATCH_CATEGORY_ID;

        // 1. Yöntem: match.lobbyVoiceId üzerinden bul
        if (match.lobbyVoiceId) {
            const config = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
            if (config) {
                MATCH_CATEGORY_ID = config.categoryId;
            }
        }

        // 2. Yöntem: Bulunamazsa fallback (veya eski yöntem)
        if (!MATCH_CATEGORY_ID) {
            // Eski kodda getCategoryId vardı ama artık constants.js'den kaldırdık mı?
            // constants.js'i kontrol ettim, getCategoryId kaldırılmış.
            // O yüzden varsayılan bir ID veya hata yönetimi gerekli.
            // En güvenlisi LOBBY_CONFIG[1].categoryId (Varsayılan Lobi 1)
            MATCH_CATEGORY_ID = LOBBY_CONFIG[1].categoryId;
        }

        const category = guild.channels.cache.get(MATCH_CATEGORY_ID);
        const everyone = guild.roles.everyone;

        const createPerms = (teamIds) => [
            {
                id: everyone.id,
                allow: [PermissionsBitField.Flags.ViewChannel],
                deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages]
            },
            ...teamIds.map(id => ({
                id,
                allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.Stream, PermissionsBitField.Flags.UseVAD]
            }))
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

        // ESKİ MESAJI SİL (KADROLAR BELİRLENDİ)
        if (match.draftMessageId) {
            try {
                const draftMsg = await infoChannel.messages.fetch(match.draftMessageId).catch(() => null);
                if (draftMsg) await draftMsg.delete().catch(() => { });
                match.draftMessageId = null; // ID'yi temizle
                await match.save();
            } catch (e) { }
        }

        const panelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`match_endmatch_${match.matchId}`).setLabel('🛑 Maçı Bitir').setStyle(ButtonStyle.Danger)
        );

        // Canlı Maç Embed'i Oluştur
        const mapData = MAPS.find(m => m.name === match.selectedMap);

        // Oyuncu Listelerini Oluştur
        // Tasarım Güncellemesi
        const listA = `<a:ayrma:1468003499072688309>\n${match.teamA.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok'}`;
        const listB = `<a:ayrma:1468003499072688309>\n${match.teamB.map(id => `<@${id}>`).join('\n') || 'Oyuncu yok'}`;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C) // Live Red
            .setTitle(`🔴 MAÇ BAŞLADI! (LIVE)`)
            .setDescription(`## 🗺️ Harita: **${match.selectedMap.toUpperCase()}**\nMaç şu an aktif olarak oynanıyor.`)
            .addFields(
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
            } catch (e) { console.error('Live Map Image Error:', e); }
        }

        await infoChannel.send({ embeds: [embed], components: [panelRow], files: files });
    },

    async endMatch(interaction) {
        // Sadece butonlardan gelen istekleri kabul et
        if (!interaction.isMessageComponent()) return;

        const matchId = interaction.customId.split('_')[2];
        const match = await Match.findOne({ matchId });
        if (!match) return;

        // Onay İste (Güvenlik Kilidi)
        if (interaction.customId.includes('_confirm')) {
            // İkinci kez basılmış (Onaylanmış)

            // Zaten bitmişse tekrar işlem yapma
            if (match.status === 'FINISHED') {
                return interaction.reply({ content: '⚠️ Bu maç zaten sonlandırılmış.', flags: require('discord.js').MessageFlags.Ephemeral });
            }

            // Durumu Güncelle
            match.status = 'FINISHED';
            if (!match.playedMaps.includes(match.selectedMap)) {
                match.playedMaps.push(match.selectedMap);
            }
            await match.save();

            const { MessageFlags } = require('discord.js');
            await interaction.reply({ content: '🏁 Maç ve Lobi sonlandırılıyor...', flags: MessageFlags.Ephemeral });

            // LOBİ BİTİRME İŞLEMİ (Eskiden 'endlobby' idi)
            const manager = require('./manager');
            await manager.forceEndMatch(interaction.guild, matchId, 'Maç Bitir butonu ile sonlandırıldı.');
            await manager.cleanupVoiceChannels(interaction.guild, match);

            // Kanalı 2 saniye sonra sil ki kullanıcı mesajı görsün
            setTimeout(() => {
                if (interaction.channel) interaction.channel.delete().catch(() => { });
            }, 2000);

        } else {
            // İlk kez basılmış -> Onay sor
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`match_endmatch_${matchId}_confirm`).setLabel('Evet, Bitir').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('match_abort_end').setLabel('İptal').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({
                content: '⚠️ **Maçı bitirmek üzeresiniz!**\nBu işlem geri alınamaz. Emin misiniz?',
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }
    },



    async showNextMatchOptions(channel, match) {
        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle('🏁 Maç Sonu Yönetimi')
            .setDescription(`**Bu lobiyle ne yapmak istersiniz?**\n\n🔁 **Takımlar Aynı:** Kaptanlar ve takımlar değişmeden yeni harita seçimine geçer.\n🔄 **Takımları Değiştir:** Takımları sıfırlar, kaptan seçimine döner.\n🛑 **Lobiyi Bitir:** Her şeyi siler ve kapatır.`)
            .setFooter({ text: 'Made by Swaff' });

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
