const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Bir kullanıcıyla bahisli VS at! (Sıra tabanlı savaş)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Meydan okuyacağın kişi')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Bahis miktarı')
                .setMinValue(50)
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const author = interaction.user;
        const guildId = interaction.guild.id;

        // Validasyonlar
        if (targetUser.id === author.id) return interaction.reply({ content: '❌ Kendinle kapışamazsın şizofren dostum.', flags: MessageFlags.Ephemeral });
        if (targetUser.bot) return interaction.reply({ content: '❌ Botlarla düello atamazsın.', flags: MessageFlags.Ephemeral });

        // Database Kontrolleri (Her iki tarafın parası var mı?)
        const p1 = await User.findOne({ odasi: author.id, odaId: guildId });
        const p2 = await User.findOne({ odasi: targetUser.id, odaId: guildId });

        if (!p1 || p1.balance < amount) return interaction.reply({ content: '❌ Senin yeterli paran yok.', flags: MessageFlags.Ephemeral });
        if (!p2 || p2.balance < amount) return interaction.reply({ content: `❌ **${targetUser.username}** kullanıcısının yeterli parası yok.`, flags: MessageFlags.Ephemeral });

        // --- Davet Aşaması ---
        const inviteEmbed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('⚔️ DÜELLO ÇAĞRISI')
            .setDescription(`<@${targetUser.id}>, **${author.username}** seni **${amount}** NexCoin ödüllü bir ölüm maçına davet ediyor!`)
            .setFooter({ text: 'Kabul etmek için 30 saniyen var.' });

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_duel').setLabel('Kabul Et').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('decline_duel').setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        await interaction.reply({ content: `<@${targetUser.id}>`, embeds: [inviteEmbed], components: [inviteRow] });
        const msg = await interaction.fetchReply(); // Güvenli fetch

        // Davet Collector
        const inviteCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        inviteCollector.on('collect', async i => {
            if (i.user.id !== targetUser.id && i.user.id !== author.id) { // Reddetmek için atan kişi de basabilsin
                return i.reply({ content: 'Bu düello senin için değil.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'decline_duel') {
                await i.update({ content: '❌ Düello reddedildi veya iptal edildi.', embeds: [], components: [] });
                inviteCollector.stop('declined');
                return;
            }

            if (i.customId === 'accept_duel') {
                if (i.user.id !== targetUser.id) return i.reply({ content: 'Sadece rakip kabul edebilir.', flags: MessageFlags.Ephemeral });

                inviteCollector.stop('accepted');

                // --- OYUN BAŞLIYOR ---
                // Paraları Çek (Tekrar kontrol et ve düş)
                const doc1 = await User.findOne({ odasi: author.id, odaId: guildId });
                if (doc1.balance < amount) return i.update({ content: '❌ Bakiye hatası oluştu (P1).', embeds: [], components: [] });

                const doc2 = await User.findOne({ odasi: targetUser.id, odaId: guildId });
                if (doc2.balance < amount) return i.update({ content: '❌ Bakiye hatası oluştu (P2).', embeds: [], components: [] });

                doc1.balance -= amount;
                doc2.balance -= amount;
                await doc1.save();
                await doc2.save();

                // Oyun State'i
                const game = {
                    p1: { id: author.id, name: author.username, hp: 100, maxHp: 100, potions: 2 },
                    p2: { id: targetUser.id, name: targetUser.username, hp: 100, maxHp: 100, potions: 2 },
                    turn: author.id, // İlk hamle davet edenin
                    logs: ['🔥 **MÜCADELE BAŞLADI!**']
                };

                const getGameEmbed = () => {
                    const p1Health = createHealthBar(game.p1.hp, 100);
                    const p2Health = createHealthBar(game.p2.hp, 100);

                    return new EmbedBuilder()
                        .setColor('#c0392b')
                        .setTitle('⚔️ ARENA')
                        .addFields(
                            { name: `🛡️ ${game.p1.name}`, value: `${p1Health} (${game.p1.hp} HP)\n🧪 İksir: ${game.p1.potions}`, inline: true },
                            { name: `⚔️ VS`, value: `\u200b`, inline: true },
                            { name: `🛡️ ${game.p2.name}`, value: `${p2Health} (${game.p2.hp} HP)\n🧪 İksir: ${game.p2.potions}`, inline: true },
                            { name: '📜 Savaş Günlüğü', value: game.logs.slice(-5).join('\n') || '...' }
                        )
                        .setDescription(`Sıra: <@${game.turn}>`);
                };

                const getGameRow = (playerId) => {
                    const isDisabled = game.turn !== playerId;
                    const currentPlayer = game.p1.id === playerId ? game.p1 : game.p2;

                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('atk').setLabel('Saldır (Güvenli)').setStyle(ButtonStyle.Primary).setEmoji('🗡️').setDisabled(isDisabled),
                        new ButtonBuilder().setCustomId('hv_atk').setLabel('Ağır Vur (%40 Risk)').setStyle(ButtonStyle.Danger).setEmoji('🪓').setDisabled(isDisabled),
                        new ButtonBuilder().setCustomId('heal').setLabel(`İyileş (${currentPlayer.potions})`).setStyle(ButtonStyle.Success).setEmoji('🧪').setDisabled(isDisabled || currentPlayer.potions <= 0),
                    );
                };

                // İlk Update
                await i.update({ content: '', embeds: [getGameEmbed()], components: [getGameRow(interaction.user.id)] }); // İlk sıra author'da

                // Oyun Collector
                const gameCollector = msg.createMessageComponentCollector({ time: 300000 }); // 5 dakika max oyun süresi

                gameCollector.on('collect', async move => {
                    if (move.user.id !== game.turn) {
                        return move.reply({ content: '⏳ Sıra sende değil!', flags: MessageFlags.Ephemeral });
                    }

                    const attacker = game.turn === game.p1.id ? game.p1 : game.p2;
                    const defender = game.turn === game.p1.id ? game.p2 : game.p1;
                    let log = '';
                    let damage = 0;

                    // HAMLE LOGIĞI
                    if (move.customId === 'atk') {
                        damage = Math.floor(Math.random() * (20 - 12 + 1)) + 12; // 12-20
                        const isCrit = Math.random() < 0.10; // %10 Crit
                        if (isCrit) { damage = Math.floor(damage * 1.5); log = `🎯 **KRİTİK!** ${attacker.name}, ${defender.name}'a **${damage}** hasar vurdu!`; }
                        else { log = `🗡️ ${attacker.name}, ${defender.name}'a **${damage}** hasar vurdu.`; }

                        defender.hp -= damage;
                    }
                    else if (move.customId === 'hv_atk') {
                        // %40 Iskalar
                        if (Math.random() < 0.40) {
                            log = `💨 ${attacker.name} ağır bir darbe denedi ama **ISKALADI!**`;
                        } else {
                            damage = Math.floor(Math.random() * (50 - 30 + 1)) + 30; // 30-50
                            log = `🪓 **GÜM!** ${attacker.name}, ${defender.name}'ın kafasına **${damage}** vurdu!`;
                            defender.hp -= damage;
                        }
                    }
                    else if (move.customId === 'heal') {
                        if (attacker.potions > 0) {
                            const heal = Math.floor(Math.random() * (30 - 15 + 1)) + 15; // 15-30
                            attacker.hp = Math.min(attacker.hp + heal, 100);
                            attacker.potions--;
                            log = `🧪 ${attacker.name} iksir içti ve **${heal}** can yeniledi.`;
                        }
                    }

                    game.logs.push(log);

                    // ÖLÜM KONTROLÜ
                    if (defender.hp <= 0) {
                        defender.hp = 0;
                        gameCollector.stop('finished');

                        const winAmount = amount * 2;
                        // Winner'a para ver
                        await User.findOneAndUpdate({ odasi: attacker.id, odaId: guildId }, { $inc: { balance: winAmount } });

                        const finishEmbed = new EmbedBuilder()
                            .setColor('#f1c40f')
                            .setTitle('🏆 DÜELLO BİTTİ!')
                            .setDescription(`👑 **KAZANAN:** <@${attacker.id}>\n💀 **Kaybeden:** <@${defender.id}>\n\n💰 **Ödül:** ${winAmount} NexCoin`)
                            .addFields({ name: 'Son Durum', value: game.logs.slice(-3).join('\n') });

                        await move.update({ embeds: [finishEmbed], components: [] });

                        // Quest Update
                        try {
                            const { updateQuestProgress } = require('../../utils/questManager');
                            await updateQuestProgress({ odasi: attacker.id, odaId: guildId }, 'gamble', 1);
                        } catch (e) { }

                    } else {
                        // SIRA DEĞİŞTİR
                        game.turn = defender.id;
                        await move.update({ embeds: [getGameEmbed()], components: [getGameRow(game.turn)] });
                    }
                });
            }
        });

        inviteCollector.on('end', (c, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏱️ Davet zaman aşımına uğradı.', embeds: [], components: [] }).catch(() => { });
            }
        });
    }
};

function createHealthBar(current, max) {
    const total = 10;
    const progress = Math.round((current / max) * total);
    const empty = total - progress;
    return '🟩'.repeat(Math.max(0, progress)) + '⬜'.repeat(Math.max(0, empty));
}
