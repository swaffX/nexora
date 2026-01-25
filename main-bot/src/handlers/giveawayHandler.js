const path = require('path');
const { MessageFlags } = require('discord.js');
const { Giveaway } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    async handleButton(interaction, args, client) {
        const action = args[0];

        if (action === 'join') {
            const giveaway = await Giveaway.findOne({ messageId: interaction.message.id });

            if (!giveaway) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Çekiliş bulunamadı.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (giveaway.ended) {
                return interaction.reply({
                    embeds: [embeds.error('Hata', 'Bu çekiliş bitmiş.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (giveaway.participants.includes(interaction.user.id)) {
                // Çekilişten çık
                giveaway.participants = giveaway.participants.filter(p => p !== interaction.user.id);
                await giveaway.save();

                return interaction.reply({
                    embeds: [embeds.warning('Çekilişten Çıktınız', 'Çekilişten ayrıldınız.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Çekilişe katıl
            giveaway.participants.push(interaction.user.id);
            await giveaway.save();

            await interaction.reply({
                embeds: [embeds.success('Çekilişe Katıldınız', `**${giveaway.prize}** çekilişine katıldınız!`)],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
