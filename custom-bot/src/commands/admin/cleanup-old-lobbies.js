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
            // Eski lobi ID'leri (constants.js'den önceki)
            const oldLobby2CategoryId = '1467987284623233218';
            const oldLobby3CategoryId = '1467987452039004346';

            const oldCategories = [oldLobby2CategoryId, oldLobby3CategoryId];

            for (const categoryId of oldCategories) {
                const category = guild.channels.cache.get(categoryId);
                if (category) {
                    // Kategori içindeki tüm kanalları sil
                    const channels = category.children.cache;
                    for (const [id, channel] of channels) {
                        await channel.delete().catch(() => {});
                        deletedCount++;
                    }
                    // Kategoriyi sil
                    await category.delete().catch(() => {});
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                await interaction.editReply({ 
                    content: `✅ Eski lobi kanalları temizlendi!\n\n🗑️ Silinen kanal sayısı: ${deletedCount}\n\n💡 Artık yeni sistem aktif. \`/setup-match\` ile ana lobi panelini kurabilirsiniz.` 
                });
            } else {
                await interaction.editReply({ 
                    content: '✅ Temizlenecek eski kanal bulunamadı. Sistem zaten güncel!' 
                });
            }

        } catch (error) {
            console.error('Cleanup Error:', error);
            await interaction.editReply({ content: '❌ Temizlik sırasında hata oluştu!' });
        }
    }
};
