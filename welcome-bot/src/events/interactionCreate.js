const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isButton()) {
            if (interaction.customId === 'verify_user') {
                const verifyHandler = require('../handlers/verifyHandler');
                await verifyHandler.handleVerify(interaction, client);
                return;
            }

            if (interaction.customId.startsWith('verify_captcha_')) {
                // Buton DM'den geldiği için ephemeral aslında sadece o DM'de geçerli
                await interaction.deferUpdate();

                const guildId = interaction.customId.split('_')[2];
                const guild = client.guilds.cache.get(guildId);

                const { MessageFlags } = require('discord.js');
                if (!guild) return interaction.followUp({ content: '❌ Sunucu bulunamadı. Muhtemelen bot sunucudan atıldı.', flags: MessageFlags.Ephemeral });

                const member = await guild.members.fetch(interaction.user.id).catch(() => null);
                if (!member) return interaction.followUp({ content: '❌ Sunucuda bulunamadın. (Çıkmış olabilirsin).', flags: MessageFlags.Ephemeral });

                const UNREG_ROLE_ID = '1463875341553635553';
                const LOG_CHANNEL_ID = '1464177606684315730';
                const REGISTER_CHANNEL_ID = '1463875473703436289';

                if (member.roles.cache.has(UNREG_ROLE_ID)) {
                    return interaction.followUp({ content: '✅ Zaten doğrulanmışsın.', flags: MessageFlags.Ephemeral });
                }

                try {
                    await member.roles.add(UNREG_ROLE_ID);
                    await interaction.editReply({ content: '✅ **Doğrulama Başarılı!** Sunucuya erişimin açıldı.', components: [] }); // Butonu kaldır

                    // Log
                    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
                    if (channel) await channel.send(`✅ <@${member.id}> bot olmadığını doğruladı ve sunucuya alındı.`);

                } catch (err) {
                    console.error(err);
                    await interaction.followUp({ content: '❌ İşlem sırasında hata oluştu.', flags: MessageFlags.Ephemeral });
                }
            }
        }
    }
},
};
