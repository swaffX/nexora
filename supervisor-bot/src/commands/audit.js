const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { runAudit } = require('../handlers/auditHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Nexora Supervisor - Sistem Güvenlik Taraması')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const report = await runAudit(interaction.guild);

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31) // Koyu Gri (Profesyonel)
            .setTitle(`👁️ Nexora Supervisor - Denetim Raporu`)
            .setDescription(`**Sunucu:** ${interaction.guild.name}\n**Tarih:** <t:${Math.floor(Date.now() / 1000)}:f>`)
            .setTimestamp()
            .setFooter({ text: 'Nexora Supervisor System' });

        // 1. Riskli Roller
        const riskyText = report.riskyRoles.length > 0
            ? report.riskyRoles.map(r => `• **${r.name}** (${r.members} kişi)`).join('\n')
            : '✅ Kritik yetkili rolü bulunamadı.';
        embed.addFields({ name: '🚨 Kritik Yetki (Admin)', value: riskyText.substring(0, 1024) });

        // 2. Açık Kanallar
        const channelsText = report.openChannels.length > 0
            ? report.openChannels.map(c => `<#${interaction.guild.channels.cache.find(ch => ch.name === c)?.id}>`).join(', ')
            : '✅ Tüm kanallar @everyone için güvenli.';
        embed.addFields({ name: '🔓 Everyone Açık Kanallar', value: channelsText.substring(0, 1024) });

        // 3. Riskli Botlar
        const botsText = report.riskyBots.map(b => `\`${b}\``).join(', ') || '✅ Yönetici yetkili bot yok.';
        embed.addFields({ name: '🤖 Yönetici Botlar', value: botsText.substring(0, 1024) });

        // 4. Everyone Ping
        const pingText = report.everyonePing.map(r => `\`${r}\``).join(', ') || '✅ Sadece Yönetici ve @everyone.';
        embed.addFields({ name: '📢 Everyone Atabilenler', value: pingText.substring(0, 1024) });

        // 5. Boş Roller
        const unusedText = report.unusedRoles.length > 0
            ? (report.unusedRoles.slice(0, 10).join(', ') + (report.unusedRoles.length > 10 ? ` (+${report.unusedRoles.length - 10} adet)` : ''))
            : '✅ Boş rol yok.';
        embed.addFields({ name: '👻 Pasif/Boş Roller', value: unusedText.substring(0, 1024) });

        await interaction.editReply({ embeds: [embed] });
    }
};
