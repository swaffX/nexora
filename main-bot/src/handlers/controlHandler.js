const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const { checkAchievements } = require('../utils/achievementManager');

module.exports = {
    async handleButton(interaction) {
        const { customId } = interaction;
        if (!customId.startsWith('ctrl_')) return;

        await interaction.deferReply({ ephemeral: true });

        const userData = await User.findOrCreate(interaction.user.id, interaction.guild.id, interaction.user.username);
        const action = customId.split('_')[1];

        try {
            switch (action) {
                case 'profile':
                    await this.showProfile(interaction, userData);
                    break;
                case 'daily':
                    await this.claimDaily(interaction, userData);
                    break;
                case 'inventory':
                    await this.showInventory(interaction, userData);
                    break;
                case 'wallet':
                    await this.showWallet(interaction, userData);
                    break;
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu.' });
        }
    },

    async showProfile(interaction, userData) {
        // Achievement sayısını al
        const achCount = userData.achievements ? userData.achievements.length : 0;

        // Next Level XP hesabı (Basit formül: 100 * level^2)
        const nextLevelXP = 100 * Math.pow((userData.level || 0) + 1, 2);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('👤 Kullanıcı Profili')
            .addFields(
                { name: '⭐ Seviye', value: `Level **${userData.level}**\nXP: ${Math.floor(userData.xp)} / ${nextLevelXP}`, inline: true },
                { name: '💰 Bakiye', value: `**${userData.balance.toLocaleString()}** Coin`, inline: true },
                { name: '🏆 Başarımlar', value: `**${achCount}** Rozet`, inline: true },
                { name: '📊 İstatistikler', value: `✉️ Mesaj: **${userData.totalMessages}**\n🎙️ Ses: **${Math.floor(userData.totalVoiceMinutes / 60)} Saat**`, inline: false }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }));

        await interaction.editReply({ embeds: [embed] });
    },

    async claimDaily(interaction, userData) {
        const now = new Date();
        const lastDaily = userData.lastDaily ? new Date(userData.lastDaily) : 0;
        const diff = now - lastDaily;
        const oneDay = 24 * 60 * 60 * 1000;

        if (diff < oneDay) {
            const remaining = oneDay - diff;
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            return interaction.editReply({
                content: `⏳ Günlük ödülünü zaten aldın! **${hours} saat ${minutes} dakika** sonra tekrar gel.`
            });
        }

        // Ödül (Örn: 500 - 1000 arası)
        const reward = Math.floor(Math.random() * 500) + 500;
        userData.balance += reward;
        userData.lastDaily = now;
        await userData.save();

        // Başarım Kontrolü (Para kazandı sonuçta)
        await checkAchievements(userData, interaction);

        await interaction.editReply({
            embeds: [embeds.success('Günlük Ödül', `Bugünkü maaşın yatırıldı: **+${reward} NexCoin** 💸`)]
        });
    },

    async showInventory(interaction, userData) {
        const { ITEMS } = require(path.join(__dirname, '..', '..', '..', 'shared', 'gameData'));

        if (!userData.inventory || userData.inventory.length === 0) {
            return interaction.editReply({ content: '🎒 Envanterin bomboş! `/market` yazarak bir şeyler al.' });
        }

        const items = userData.inventory.map(slot => {
            const itemDef = Object.values(ITEMS).find(i => i.id === slot.itemId);
            return itemDef ? `${itemDef.emoji} **${itemDef.name}** (x${slot.amount})` : `❓ Bilinmeyen Eşya (${slot.itemId})`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎒 Envanter')
            .setDescription(items);

        await interaction.editReply({ embeds: [embed] });
    },

    async showWallet(interaction, userData) {
        const embed = new EmbedBuilder()
            .setColor(0GOLD)
            .setDescription(`💳 **Cüzdanın:** ${userData.balance.toLocaleString()} NexCoin\n🏦 **Bankan:** ${userData.bank.toLocaleString()} NexCoin`);
        await interaction.editReply({ embeds: [embed] });
    }
};
