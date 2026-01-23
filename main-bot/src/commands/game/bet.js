const { SlashCommandBuilder } = require('discord.js');
const User = require('../../../../shared/models/User');
const Match = require('../../../../shared/models/Match');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bet')
        .setDescription('Tarafını seç ve bahsini oyna!')
        .addStringOption(option =>
            option.setName('team')
                .setDescription('Hangi takıma oynamak istiyorsun?')
                .setRequired(true)
                .addChoices(
                    { name: 'Team A (Kırmızı)', value: 'A' },
                    { name: 'Team B (Mavi)', value: 'B' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Ne kadar yatıracaksın?')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const team = interaction.options.getString('team');
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 1. Kullanıcı Bakiyesi Kontrolü
        const user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user || user.balance < amount) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Mevcut bakiyen: **${user ? user.balance : 0}** coin.`, ephemeral: true });
        }

        // 2. Aktif Maç Kontrolü
        // Bu kanalda aktif bir maç var mı?
        // Durumu SETUP olmayan, bitmemiş maçlar.
        const match = await Match.findOne({
            channelId: interaction.channelId,
            status: { $in: ['DRAFT', 'VETO', 'SIDE_SELECTION', 'LIVE'] }
        });

        if (!match) {
            return interaction.reply({ content: `❌ Bu kanalda şu anda bahis oynanabilecek aktif bir maç yok.`, ephemeral: true });
        }

        // Maç çoktan bitmişse (LIVE sonrası logic değişirse) - Status check zaten yukarda var.

        // Zaten oynamış mı?
        const existingBet = match.bets.find(b => b.userId === userId);
        if (existingBet) {
            return interaction.reply({ content: `⚠️ Zaten bu maça **${existingBet.amount}** coin bahis yaptın (Team ${existingBet.team}).`, ephemeral: true });
        }

        // 3. İşlem (ATOMİK)
        // Parayı atomik olarak düş
        const updatedUser = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!updatedUser) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! İşlem sırasında paranız yetersiz kaldı.`, ephemeral: true });
        }

        // Bahsi kaydet
        match.bets.push({
            userId: userId,
            team: team,
            amount: amount,
            claimed: false
        });
        await match.save();

        return interaction.reply({
            content: `✅ Başarılı! **Team ${team}** tarafına **${amount}** coin yatırdın.\nMaç sonucu bekleniyor...`,
            ephemeral: false
        });
    }
};
