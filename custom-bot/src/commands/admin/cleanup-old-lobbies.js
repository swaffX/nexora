const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-old-lobbies')
        .setDescription('Eski Lobby 2 ve Lobby 3 kanallarını siler')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        let deletedCount = 0;

        try {
            // Eski lobi ID'leri (manuel silinen kanallar)
            const oldChannelIds = [
                '1469371487965286400', // Eski Lobi 2 Bekleme
                '1469371490163097600', // Eski Lobi 3 Bekleme
                '1467987284623233218', // Eski Lobby 2 Kategorisi
                '1467987452039004346'  // Eski Lobby 3 Kategorisi
            ];

            for (const channelId of oldChannelIds) {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    // Eğer kategori ise içindeki kanalları da sil
                    if (channel.type === 4) { // GuildCategory
                        const children = channel.children.cache;
                        for (const [id, child] of children) {
                            await child.delete().catch(() => {});
                            deletedCount++;
                        }
                    }
                    await channel.delete().catch(() => {});
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                await interaction.editReply({ 
                    content: `✅ Eski lobi kanalları temizlendi!\n\n🗑️ Silinen kanal sayısı: ${deletedCount}\n\n💡 Artık yeni sistem aktif. \`/setup-match\` ile ana lobi panelini kurabilirsiniz.` 
                });
            } else {
                await interaction.editReply({ 
                    content: '✅ Temizlenecek eski kanal bulunamadı. Sistem zaten güncel!\n\n📌 Mevcut yapı:\n- Lobi Bekleme: <#1469371485855547587>\n- Maç Panel: <#1464222855398166612>' 
                });
            }

        } catch (error) {
            console.error('Cleanup Error:', error);
            await interaction.editReply({ content: '❌ Temizlik sırasında hata oluştu!' });
        }
    }
};
