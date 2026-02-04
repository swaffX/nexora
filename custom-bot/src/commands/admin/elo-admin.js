const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo-admin')
        .setDescription('ELO yönetim komutu (Admin)')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Bir kullanıcının ELO\'sunu ayarla')
                .addUserOption(opt => opt.setName('user').setDescription('Hedef kullanıcı').setRequired(true))
                .addIntegerOption(opt => opt.setName('elo').setDescription('Yeni ELO değeri').setRequired(true).setMinValue(0).setMaxValue(3000))
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Bir kullanıcının ELO\'sunu varsayılana sıfırla (200)')
                .addUserOption(opt => opt.setName('user').setDescription('Hedef kullanıcı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Bir kullanıcıya ELO ekle')
                .addUserOption(opt => opt.setName('user').setDescription('Hedef kullanıcı').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Eklenecek ELO miktarı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Bir kullanıcıdan ELO çıkar')
                .addUserOption(opt => opt.setName('user').setDescription('Hedef kullanıcı').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Çıkarılacak ELO miktarı').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('reset-all')
                .setDescription('TÜM kullanıcıların ELO\'sunu sıfırla (DİKKAT!)')
        ),

    async execute(interaction) {
        // Sadece adminler
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir!', flags: MessageFlags.Ephemeral });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (subcommand === 'set') {
                const targetUser = interaction.options.getUser('user');
                const newElo = interaction.options.getInteger('elo');

                let userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });
                if (!userDoc) {
                    userDoc = new User({ odasi: targetUser.id, odaId: guildId, matchStats: eloService.createDefaultStats() });
                }

                eloService.ensureValidStats(userDoc);
                const oldElo = userDoc.matchStats.elo;
                userDoc.matchStats.elo = newElo;
                userDoc.matchStats.matchLevel = eloService.getLevelFromElo(newElo);
                await userDoc.save();

                return interaction.editReply(`✅ **${targetUser.username}** ELO ayarlandı: \`${oldElo}\` → \`${newElo}\` (Level ${userDoc.matchStats.matchLevel})`);

            } else if (subcommand === 'reset') {
                const targetUser = interaction.options.getUser('user');

                let userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });
                if (!userDoc) {
                    userDoc = new User({ odasi: targetUser.id, odaId: guildId, matchStats: eloService.createDefaultStats() });
                }

                eloService.ensureValidStats(userDoc);
                const oldElo = userDoc.matchStats.elo;
                userDoc.matchStats = eloService.createDefaultStats();
                await userDoc.save();

                return interaction.editReply(`✅ **${targetUser.username}** ELO sıfırlandı: \`${oldElo}\` → \`${eloService.ELO_CONFIG.DEFAULT_ELO}\``);

            } else if (subcommand === 'add') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                let userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });
                if (!userDoc) {
                    userDoc = new User({ odasi: targetUser.id, odaId: guildId, matchStats: eloService.createDefaultStats() });
                }

                eloService.ensureValidStats(userDoc);
                const oldElo = userDoc.matchStats.elo;
                userDoc.matchStats.elo = Math.min(userDoc.matchStats.elo + amount, eloService.ELO_CONFIG.MAX_ELO);
                userDoc.matchStats.matchLevel = eloService.getLevelFromElo(userDoc.matchStats.elo);
                await userDoc.save();

                return interaction.editReply(`✅ **${targetUser.username}** ELO eklendi: \`${oldElo}\` → \`${userDoc.matchStats.elo}\` (+${amount})`);

            } else if (subcommand === 'remove') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                let userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });
                if (!userDoc) {
                    userDoc = new User({ odasi: targetUser.id, odaId: guildId, matchStats: eloService.createDefaultStats() });
                }

                eloService.ensureValidStats(userDoc);
                const oldElo = userDoc.matchStats.elo;
                userDoc.matchStats.elo = Math.max(userDoc.matchStats.elo - amount, eloService.ELO_CONFIG.MIN_ELO);
                userDoc.matchStats.matchLevel = eloService.getLevelFromElo(userDoc.matchStats.elo);
                await userDoc.save();

                return interaction.editReply(`✅ **${targetUser.username}** ELO çıkarıldı: \`${oldElo}\` → \`${userDoc.matchStats.elo}\` (-${amount})`);

            } else if (subcommand === 'reset-all') {
                // Tüm kullanıcıları sıfırla
                const result = await User.updateMany(
                    { odaId: guildId, 'matchStats.elo': { $exists: true } },
                    {
                        $set: {
                            'matchStats.elo': eloService.ELO_CONFIG.DEFAULT_ELO,
                            'matchStats.matchLevel': eloService.ELO_CONFIG.DEFAULT_LEVEL,
                            'matchStats.totalMatches': 0,
                            'matchStats.totalWins': 0
                        }
                    }
                );

                return interaction.editReply(`✅ **${result.modifiedCount}** kullanıcının ELO'su \`${eloService.ELO_CONFIG.DEFAULT_ELO}\` olarak sıfırlandı!`);
            }

        } catch (error) {
            console.error('ELO Admin Error:', error);
            return interaction.editReply(`❌ Hata: ${error.message}`);
        }
    }
};
