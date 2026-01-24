const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { runAudit } = require('../handlers/auditHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Sunucu güvenlik ve sağlık taraması yapar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const report = await runAudit(interaction.guild);

        const embed = new EmbedBuilder()
            .setColor(0x3498DB) // Mavi
            .setTitle(`🛡️ Nexora Sağlık Raporu - ${interaction.guild.name}`)
            .setDescription('Sunucu yapılandırması tarandı. İşte sonuçlar:')
            .setTimestamp()
            .setFooter({ text: 'Autoviser Security Scan' });

        // 1. Riskli Roller
        const riskyText = report.riskyRoles.length > 0
            ? report.riskyRoles.map(r => `• **${r.name}** (${r.members} üye)`).join('\n')
            : '✅ Yönetici rolü bulunamadı (veya sadece botlarda var).';
        embed.addFields({ name: '🚨 Yönetici Rolleri (Admin)', value: riskyText.substring(0, 1024) });

        // 2. Açık Kanallar
        const channelsText = report.openChannels.length > 0
            ? report.openChannels.map(c => `#${c}`).join(', ')
            : '✅ Tüm kanallar @everyone yazımına kapalı.';
        embed.addFields({ name: '🔓 Herkese Açık Kanallar (@everyone)', value: channelsText.substring(0, 1024) });

        // 3. Riskli Botlar
        const botsText = report.riskyBots.map(b => `\`${b}\``).join(', ') || '✅ Yönetici yetkili bot yok.';
        embed.addFields({ name: '🤖 Yönetici Botlar', value: botsText.substring(0, 1024) });

        // 4. Everyone Ping
        const pingText = report.everyonePing.map(r => `\`${r}\``).join(', ') || '✅ Sadece Yönetici ve @everyone.';
        embed.addFields({ name: '📢 Everyone Atabilen Ek Roller', value: pingText.substring(0, 1024) });

        // 5. Boş Roller
        const unusedText = report.unusedRoles.length > 0
            ? (report.unusedRoles.slice(0, 15).join(', ') + (report.unusedRoles.length > 15 ? ` ve ${report.unusedRoles.length - 15} tane daha...` : ''))
            : '✅ Boş rol yok.';
        embed.addFields({ name: '👻 Kullanılmayan Roller', value: unusedText.substring(0, 1024) });

        await interaction.editReply({ embeds: [embed] });
    }
};
