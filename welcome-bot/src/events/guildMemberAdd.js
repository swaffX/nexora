const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment');
moment.locale('tr');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        // --- AYARLAR ---
        const UNREG_ROLE_ID = '1463875341553635553';
        const LOG_CHANNEL_ID = '1464177606684315730'; // Hoş geldin kanalı
        const REGISTER_CHANNEL_ID = '1463875473703436289'; // Kullanıcıyı yönlendireceğimiz kanal
        const MIN_AGE_DAYS = 3; // 3 Günden yeni hesaplar şüpheli

        // Hesap Yaşı Kontrolü
        const created = member.user.createdTimestamp;
        const diff = Date.now() - created;
        const dayDiff = diff / (1000 * 60 * 60 * 24);
        const accountAge = moment(created).fromNow();

        // Log için kanal bul
        const channel = member.guild.channels.cache.get(LOG_CHANNEL_ID);

        // --- ŞÜPHELİ HESAP KONTROLÜ ---
        if (dayDiff < MIN_AGE_DAYS) {
            logger.guard('SUSPICIOUS', `${member.user.tag} sunucuya girdi ama hesabı yeni (${Math.floor(dayDiff)} günlük).`);

            // Sunucu kanalına uyarı at
            if (channel) {
                await channel.send({
                    content: `⚠️ <@${member.id}> sunucuya katıldı ancak hesabı **ÇOK YENİ (Şüpheli)** olduğu için karantinaya alındı.\n📅 Hesap Tarihi: ${accountAge}`
                });
            }

            // DM'den Captcha Gönder
            try {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_captcha_${member.guild.id}`) // Guild ID'yi taşıyalım
                        .setLabel('Ben Bot Değilim 🤖')
                        .setStyle(ButtonStyle.Success)
                );

                await member.send({
                    content: `✋ Selam! **${member.guild.name}** sunucusuna giriş yaptın fakat hesabın güvenlik filtrelerine takıldı (Yeni Hesap).\n\nEğer bir bot olmadığını kanıtlamak istiyorsan aşağıdaki butona tıkla.`,
                    components: [row]
                }).catch(() => {
                    if (channel) channel.send(`ℹ️ <@${member.id}> kullanıcısının DM kutusu kapalı, doğrulama gönderilemedi.`);
                });
            } catch (e) { }
            return; // Rol verme, işlemi bitir.
        }

        // --- GÜVENLİ HESAP ---

        // Oto Rol
        const role = member.guild.roles.cache.get(UNREG_ROLE_ID);
        if (role) {
            await member.roles.add(role).catch(e => logger.error('Oto rol hatası:', e));
        }

        // Hoş Geldin Mesajı
        if (channel) {
            const memberCount = member.guild.memberCount;

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`👋 Hoşgeldin ${member.user.username}!`)
                .setDescription(`Topluluğumuza hoşgeldin! Kayıt olmak için <#${REGISTER_CHANNEL_ID}> kanalındaki butona tıklayabilirsin.`)
                .addFields(
                    { name: '🎂 Hesap Tarihi', value: `${accountAge}`, inline: true },
                    { name: '📊 Toplam Üye', value: `${memberCount}`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Nexora Güvenlik`, iconURL: member.guild.iconURL() })
                .setTimestamp();

            await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
        }
    },
};
