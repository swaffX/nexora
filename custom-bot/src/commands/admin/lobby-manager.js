const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { ADDITIONAL_LOBBIES, MAIN_LOBBY } = require('../../handlers/match/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lobby-manager')
        .setDescription('Ek lobi yönetimi (Lobby 2 ve 3)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Ek lobi aç')
                .addIntegerOption(opt =>
                    opt.setName('lobby')
                        .setDescription('Lobi numarası')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Lobby 2', value: 2 },
                            { name: 'Lobby 3', value: 3 }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Ek lobi kapat')
                .addIntegerOption(opt =>
                    opt.setName('lobby')
                        .setDescription('Lobi numarası')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Lobby 2', value: 2 },
                            { name: 'Lobby 3', value: 3 }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Tüm lobilerin durumunu göster')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('🎮 Lobi Durumu')
                .setColor(0x5865F2)
                .addFields(
                    {
                        name: '🟢 Ana Lobi',
                        value: `Kategori: <#${MAIN_LOBBY.categoryId}>\nPanel: <#${MAIN_LOBBY.setupChannelId}>\nBekleme: <#${MAIN_LOBBY.voiceId}>\nDurum: **Her zaman aktif**`,
                        inline: false
                    }
                );

            for (const [id, lobby] of Object.entries(ADDITIONAL_LOBBIES)) {
                const status = lobby.enabled ? '🟢 Aktif' : '🔴 Kapalı';
                const channels = lobby.enabled && lobby.categoryId
                    ? `Kategori: <#${lobby.categoryId}>\nPanel: <#${lobby.setupChannelId}>\nBekleme: <#${lobby.voiceId}>`
                    : 'Henüz oluşturulmadı';

                embed.addFields({
                    name: `${status} ${lobby.name}`,
                    value: channels,
                    inline: false
                });
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const lobbyId = interaction.options.getInteger('lobby');
        const lobby = ADDITIONAL_LOBBIES[lobbyId];

        if (!lobby) {
            return interaction.reply({ content: '❌ Geçersiz lobi!', ephemeral: true });
        }

        if (subcommand === 'enable') {
            if (lobby.enabled) {
                return interaction.reply({ content: `⚠️ ${lobby.name} zaten aktif!`, ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                // Kategori oluştur
                const category = await interaction.guild.channels.create({
                    name: `🎮 ${lobby.name.toUpperCase()}`,
                    type: ChannelType.GuildCategory,
                    position: 1
                });

                // Maç panel kanalı oluştur
                const panelChannel = await interaction.guild.channels.create({
                    name: `🕹️-maç-panel-${lobbyId}`,
                    type: ChannelType.GuildText,
                    parent: category.id
                });

                // Bekleme ses kanalı oluştur
                const voiceChannel = await interaction.guild.channels.create({
                    name: `🎮 Lobi ${lobbyId} Bekleme`,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 99
                });

                // Config güncelle
                lobby.categoryId = category.id;
                lobby.setupChannelId = panelChannel.id;
                lobby.voiceId = voiceChannel.id;
                lobby.enabled = true;

                // Panel mesajını gönder
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor(0x2F3136)
                    .setAuthor({ 
                        name: `NEXORA COMPETITIVE • ${lobby.name}`, 
                        iconURL: 'https://cdn.discordapp.com/emojis/1467546027518197915.webp?size=96&quality=lossless' 
                    })
                    .setDescription(`## <:valo:1468313683469013206> ARENAYA HOŞ GELDİN <a:tacticbear:1467545426009002055>\n\nTakımını topla, stratejini belirle ve mücadeleye başla.\nOdanı kurmak için aşağıdaki butonu kullan.\n\n> <a:jetto:1467545477221318750> **Dikkat:** Odamızı kurmadan önce **<#${voiceChannel.id}>** ses kanalına giriş yapınız.`)
                    .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif')
                    .setFooter({ text: 'Nexora Systems' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_create_${lobbyId}`)
                        .setLabel('Maç Oluştur')
                        .setEmoji('1467546027518197915')
                        .setStyle(ButtonStyle.Secondary)
                );

                await panelChannel.send({ embeds: [embed], components: [row] });

                await interaction.editReply({
                    content: `✅ **${lobby.name}** başarıyla açıldı!\n\n📁 Kategori: <#${category.id}>\n📋 Panel: <#${panelChannel.id}>\n🔊 Bekleme: <#${voiceChannel.id}>`
                });

            } catch (error) {
                console.error('Lobby Enable Error:', error);
                await interaction.editReply({ content: '❌ Lobi oluşturulurken hata oluştu!' });
            }

        } else if (subcommand === 'disable') {
            if (!lobby.enabled) {
                return interaction.reply({ content: `⚠️ ${lobby.name} zaten kapalı!`, ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                // Kategoriyi ve içindeki tüm kanalları sil
                const category = interaction.guild.channels.cache.get(lobby.categoryId);
                if (category) {
                    const channels = category.children.cache;
                    for (const [id, channel] of channels) {
                        await channel.delete().catch(() => {});
                    }
                    await category.delete().catch(() => {});
                }

                // Config sıfırla
                lobby.categoryId = null;
                lobby.setupChannelId = null;
                lobby.voiceId = null;
                lobby.enabled = false;

                await interaction.editReply({ content: `✅ **${lobby.name}** kapatıldı ve kanallar silindi.` });

            } catch (error) {
                console.error('Lobby Disable Error:', error);
                await interaction.editReply({ content: '❌ Lobi kapatılırken hata oluştu!' });
            }
        }
    }
};
