const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const LOBBY_VOICE_ID = '1463922466467483801';

module.exports = {
    async handleInteraction(interaction, client) {
        if (!client.matchData) client.matchData = new Map();

        const { customId } = interaction;

        if (customId === 'match_create') {
            const lobbyChannel = interaction.guild.channels.cache.get(LOBBY_VOICE_ID);
            if (!lobbyChannel) {
                try { await interaction.guild.channels.fetch(LOBBY_VOICE_ID); } catch (e) { }
            }
            const channel = interaction.guild.channels.cache.get(LOBBY_VOICE_ID);

            if (!channel) return interaction.reply({ content: 'Lobiye erişilemiyor (ID Hatalı veya Bot Görmüyor).', ephemeral: true });

            const members = Array.from(channel.members.values()).filter(m => !m.user.bot);

            if (members.length < 1) {
                return interaction.reply({ content: '🔴 Lobide listelenecek oyuncu yok! (Seste kimse yok)', ephemeral: true });
            }

            const options = members.map(m => ({
                label: m.displayName,
                value: m.id,
                emoji: '👤'
            })).slice(0, 25);

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('match_select_team1')
                        .setPlaceholder('Takım 1 Oyuncularını Seç')
                        .setMinValues(1)
                        .setMaxValues(Math.min(5, options.length))
                        .addOptions(options)
                );

            await interaction.reply({ content: '🛠️ **Maç Kurulumu**\nSadece lobideki oyuncular listeleniyor.\nÖnce **Takım 1** kadrosunu seç:', components: [row], ephemeral: true });
        }

        if (customId === 'match_select_team1') {
            const selectedIds = interaction.values;
            client.matchData.set(interaction.user.id, { team1: selectedIds });

            const lobbyChannel = interaction.guild.channels.cache.get(LOBBY_VOICE_ID);
            let members = [];
            if (lobbyChannel) {
                members = Array.from(lobbyChannel.members.values()).filter(m => !m.user.bot && !selectedIds.includes(m.id));
            }

            if (members.length === 0) {
                return interaction.update({ content: '❌ Takım 2 için boşta oyuncu kalmadı (Tüm lobiyi seçtin)!', components: [] });
            }

            const options = members.map(m => ({
                label: m.displayName,
                value: m.id,
                emoji: '🛡️'
            })).slice(0, 25);

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('match_select_team2')
                        .setPlaceholder('Takım 2 Oyuncularını Seç')
                        .setMinValues(1)
                        .setMaxValues(Math.min(5, options.length))
                        .addOptions(options)
                );

            await interaction.update({ content: `✅ Takım 1 (${selectedIds.length} kişi) seçildi.\nŞimdi **Takım 2** kadrosunu seç:`, components: [row] });
        }

        if (customId === 'match_select_team2') {
            const data = client.matchData.get(interaction.user.id);
            if (!data) return interaction.update({ content: '⚠️ Oturum süresi doldu.', components: [] });

            const team1Ids = data.team1;
            const team2Ids = interaction.values;

            await interaction.update({ content: '⚔️ Savaş alanı hazırlanıyor... Kanallar açılıyor...', components: [] });

            const matchCount = await Match.countDocuments() + 1;
            const guild = interaction.guild;

            // Kategori
            const category = await guild.channels.create({
                name: `MATCH #${matchCount}`,
                type: ChannelType.GuildCategory
            });

            // Ses Kanalları
            const team1Ch = await guild.channels.create({
                name: `Team A`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 5
            });

            const team2Ch = await guild.channels.create({
                name: `Team B`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 5
            });

            // Kontrol Kanalı
            const controlCh = await guild.channels.create({
                name: 'match-admin',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            // DB Kayıt
            const newMatch = await Match.create({
                matchId: matchCount,
                guildId: guild.id,
                categoryId: category.id,
                team1ChannelId: team1Ch.id,
                team2ChannelId: team2Ch.id,
                lobbyId: LOBBY_VOICE_ID,
                creatorId: interaction.user.id
            });

            // Taşıma İşlemi (GÜNCELLENDİ)
            let movedCount = 0;
            let errorLog = '';

            const moveMember = async (id, targetCh) => {
                try {
                    const member = await guild.members.fetch(id);
                    if (member.voice.channelId) {
                        await member.voice.setChannel(targetCh);
                        movedCount++;
                    } else {
                        errorLog += `\n⚠️ <@${id}> seste değil.`;
                    }
                } catch (e) {
                    errorLog += `\n❌ <@${id}> taşınamadı: Missing Permissions (Rol yetkisini kontrol et).`;
                    console.error(e);
                }
            };

            for (const id of team1Ids) await moveMember(id, team1Ch);
            for (const id of team2Ids) await moveMember(id, team2Ch);

            const controlRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`match_end_${newMatch._id}`).setLabel('Maçı Bitir ve Herkesi Geri Taşı').setStyle(ButtonStyle.Danger).setEmoji('🏁')
                );

            let description = `
**Team A:** ${team1Ids.map(id => `<@${id}>`).join(', ')}
**Team B:** ${team2Ids.map(id => `<@${id}>`).join(', ')}

✅ Toplam ${movedCount} oyuncu taşındı.
Maç bitince aşağıdaki butona basarak herkesi lobiye çekebilirsin.
            `;

            if (errorLog) description += `\n\n**Hatalar:**${errorLog}`;

            const embed = new EmbedBuilder()
                .setTitle(`Maç #${matchCount} Aktif`)
                .setDescription(description)
                .setColor(0xF1C40F);

            await controlCh.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [controlRow] });

            client.matchData.delete(interaction.user.id);
        }

        if (customId.startsWith('match_end_')) {
            await interaction.deferReply();
            const matchDbId = customId.split('_')[2];
            const match = await Match.findById(matchDbId);

            if (!match) return interaction.editReply({ content: 'Maç verisi yok.' });

            const lobby = interaction.guild.channels.cache.get(LOBBY_VOICE_ID);
            const t1Ch = interaction.guild.channels.cache.get(match.team1ChannelId);
            const t2Ch = interaction.guild.channels.cache.get(match.team2ChannelId);
            const category = interaction.guild.channels.cache.get(match.categoryId);
            const controlCh = interaction.channel;

            await interaction.editReply({ content: '🔄 Oyuncular geri taşınıyor...' });

            if (lobby) {
                const moveBack = async (channel) => {
                    if (!channel) return;
                    const members = Array.from(channel.members.values());
                    for (const m of members) {
                        await m.voice.setChannel(lobby).catch(e => console.log('Geri taşıma hatası:', e.message));
                    }
                };

                await moveBack(t1Ch);
                await moveBack(t2Ch);
            }

            await interaction.editReply({ content: '✅ İşlem tamam. Kanallar kapatılıyor.' });

            setTimeout(async () => {
                if (t1Ch) await t1Ch.delete().catch(() => { });
                if (t2Ch) await t2Ch.delete().catch(() => { });
                if (controlCh) await controlCh.delete().catch(() => { });
                if (category) await category.delete().catch(() => { });
            }, 4000);

            await Match.deleteOne({ _id: matchDbId });
        }
    }
};
