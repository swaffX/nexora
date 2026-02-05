const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { runAudit } = require('../../handlers/auditHandler'); // Handler'a erişim (../../ çünkü commands/admin içindeyiz)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Detaylı Güvenlik, Hiyerarşi ve Rol Taraması Raporu')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { MessageFlags } = require('discord.js');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const report = await runAudit(interaction.guild);

        // Skor Rengi
        let color = 0x2ECC71; // Yeşil (Güvenli)
        let statusText = 'MÜKEMMEL ✅';
        if (report.score < 50) { color = 0xE74C3C; statusText = 'KRİTİK RİSK 🚨'; }
        else if (report.score < 80) { color = 0xF1C40F; statusText = 'DİKKAT EDİLMELİ ⚠️'; }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`👁️ Nexora Security - Güvenlik Raporu`) // Başlık güncellendi (Staff Bot)
            .setDescription(`**Sunucu Skoru:** \`${report.score}/100\` — **Durum:** ${statusText}`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Nexora Security System' }); // Footer güncellendi

        // 1. KRİTİK İNSAN ROLLERİ (Admin)
        const humanRolesText = report.riskyHumanRoles.length > 0
            ? report.riskyHumanRoles.map((r, i) => `\`${i + 1}.\` **${r.name}** — ${r.members} üye`).join('\n')
            : '✅ İnsanlarda yönetici yetkisi yok.';
        embed.addFields({ name: '👑 Yönetici Rolleri (İnsan)', value: humanRolesText.substring(0, 1024) });

        // 2. YÖNETİCİ BOT ROLLERİ
        const botRolesText = report.riskyBotRoles.length > 0
            ? report.riskyBotRoles.map(r => {
                const botUser = interaction.guild.members.cache.find(m => m.roles.cache.has(r.id) && m.user.bot);
                return `• ${r.name} ${botUser ? `(${botUser.user.tag})` : ''}`;
            }).join('\n')
            : '✅ Yok.';
        embed.addFields({ name: '🤖 Entegrasyon/Bot Rolleri', value: botRolesText.substring(0, 1024) });

        // 3. DİĞER YETKİLİ ROLLER
        if (report.dangerousRoles.length > 0) {
            const dangerText = report.dangerousRoles.map(r => `• **${r.name}** (${r.members})`).slice(0, 15).join('\n');
            embed.addFields({ name: '⚔️ Alt Yetkili Rolleri (Ban/Kick/Yönetim)', value: dangerText.substring(0, 1024) });
        }

        // 4. EVERYONE KANALLAR
        let channelsText = '✅ Güvenli.';
        if (report.openChannels.length > 0) {
            const channels = report.openChannels.map(c => `<#${c.id}>`);
            if (channels.length > 20) {
                channelsText = channels.slice(0, 20).join(' ') + ` ...ve ${channels.length - 20} tane daha.`;
            } else {
                channelsText = channels.join(' ');
            }
        }
        embed.addFields({ name: `🔓 Herkese Açık Kanallar (${report.openChannels.length})`, value: channelsText.substring(0, 1024) });

        // 5. EKSTRA BİLGİLER
        embed.addFields(
            { name: '📢 Everyone Ping', value: report.everyonePing.length > 0 ? report.everyonePing.map(r => `\`${r}\``).join(', ') : 'Temiz ✅', inline: true },
            { name: '👻 Boş Roller', value: report.unusedRoles.length > 0 ? `${report.unusedRoles.length} adet` : 'Temiz ✅', inline: true }
        );

        await interaction.editReply({ embeds: [embed] });
    }
};
