const { Collection, PermissionsBitField, AuditLogEvent } = require('discord.js');
const { Guild, User } = require('../../../shared/models');
const logger = require('../utils/logHelper');

// Limitler ve Süreler (Guards)
const LIMITS = {
    // Spam: 5 saniyede 7 mesaj
    spam: { limit: 7, time: 5000 },
    // Kanal: 10 saniyede 3 kanal silme/açma
    channel: { limit: 3, time: 10000 },
    // Rol: 10 saniyede 3 rol silme/açma
    role: { limit: 3, time: 10000 },
    // Ban/Kick: 10 saniyede 3 ban/kick
    ban: { limit: 3, time: 10000 },
    // Webhook: 10 saniyede 3 webhook
    webhook: { limit: 3, time: 10000 }
};

// Güvenli ID'ler (Bot Sahibi, Güvenilir Adminler)
// Bu listeyi config'den veya DB'den çekmek daha sağlıklı olur ama hardcode da bir korumadır.
const WHITELIST = [
    '315875588906680330', // Bot Sahibi (Zeynep)
    // Diğer güvenilir ID'ler buraya
];

// Cache Sistemleri (Ram'de tutulur)
const spamMap = new Map(); // Map<UserId, { count, lastMsgTime, timer }>
const actionMap = new Map(); // Map<UserId, { channel: [], role: [], ban: [], ... }>

module.exports = {
    // 1. SPAM KORUMASI (Message Event'inden çağrılır)
    checkSpam: async (message) => {
        if (message.author.bot || message.webhookId) return false;
        if (WHITELIST.includes(message.author.id)) return false;

        // Adminleri spamdan muaf tut (İsteğe bağlı, güvenlik için tutmayadabiliriz)
        // if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return false;

        const limit = LIMITS.spam.limit;
        const time = LIMITS.spam.time;

        if (!spamMap.has(message.author.id)) {
            spamMap.set(message.author.id, {
                count: 1,
                lastMsgTime: Date.now(),
                timer: setTimeout(() => spamMap.delete(message.author.id), time)
            });
        } else {
            const userData = spamMap.get(message.author.id);
            userData.count++;

            if (userData.count >= limit) {
                // Spam Tespit Edildi!
                // Spam Tespit Edildi!
                await message.channel.send(`🛑 **Sakin ol!** <@${message.author.id}>, çok hızlı mesaj atıyorsun. Spam engellendi.`);

                // Ciddi işlem: Timeout (Mute)
                try {
                    if (message.member.moderatable) {
                        await message.member.timeout(5 * 60 * 1000, 'Guard: Spam Koruması'); // 5dk Mute
                        await message.channel.send(`🛡️ <@${message.author.id}> spam nedeniyle 5 dakika susturuldu.`);
                    }
                } catch (e) {
                    console.error('Spam timeout error:', e);
                }

                // Mesajları sil (Hızlı temizlik)
                try {
                    // Son 10-20 mesajı tara ve bu kullanıcıya ait olanları sil
                    // (bulkDelete sadece son 14 gün için çalışır, guard için yeterli)
                    const messages = await message.channel.messages.fetch({ limit: 10 });
                    const userMessages = messages.filter(m => m.author.id === message.author.id);
                    await message.channel.bulkDelete(userMessages).catch(() => { });
                } catch (e) { }

                spamMap.delete(message.author.id); // Reset
                return true; // Spamdı ve engellendi
            }
        }
        return false;
    },

    // 2. GENEL GUARD (Channel, Role, Ban, Kick vb.)
    // Bu fonksiyon ilgili eventlerden (channelCreate, roleDelete vb.) çağrılmalı.
    checkAction: async (client, guild, type, executorId) => {
        if (!guild || !executorId) return false;
        if (executorId === client.user.id) return false; // Botu sayma
        if (WHITELIST.includes(executorId)) return false; // Whitelist

        // Botun kendi işlemleri için actionMap'i initialize et
        if (!actionMap.has(executorId)) {
            actionMap.set(executorId, {
                channel: [],
                role: [],
                ban: [],
                webhook: [],
                bot: []
            });
        }

        const stats = actionMap.get(executorId);
        const now = Date.now();

        // İlgili türdeki eylemleri temizle (Süresi dolanları sil)
        stats[type] = stats[type].filter(timestamp => now - timestamp < LIMITS[type].time);

        // Yeni eylemi ekle
        stats[type].push(now);

        // Limit kontrolü
        if (stats[type].length >= LIMITS[type].limit) {
            // LİMİT AŞILDI -> KORUMA AKTİF
            return await quarantineUser(guild, executorId, `Guard: Anti-${type} (Limit ${LIMITS[type].limit})`);
        }

        return false;
    }
};

// 🛑 KARANTİNA FONKSİYONU (Rolleri Al + Jail/Ban)
async function quarantineUser(guild, userId, reason) {
    try {
        const member = await guild.members.fetch(userId);
        if (!member) return false;

        // 1. Yönetici ise önce yetkilerini almaya çalış (Tehlikeli Rollere Check Atılabilir)
        // Discord API'de botun rolünden yüksek rolleri alamaz, ama yöneticiyi banlayamazsa bile rolünü almayı dener.

        const dangerousPermissions = [
            PermissionsBitField.Flags.Administrator,
            PermissionsBitField.Flags.ManageGuild,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.KickMembers
        ];

        // Tehlikeli yetkisi var mı?
        const hasDangerousPerms = member.permissions.has(dangerousPermissions);

        if (hasDangerousPerms) {
            // Rollerini Çek (Managed olanlar hariç)
            const rolesToRemove = member.roles.cache.filter(r => !r.managed && r.name !== '@everyone' && r.position < guild.members.me.roles.highest.position);

            await member.roles.remove(rolesToRemove, reason).catch(e => console.error('Rol alma hatası:', e));
        }

        // 2. JAIL veya BAN
        // Nuke gibi ciddi durumlarda BAN daha güvenlidir.
        if (member.bannable) {
            await member.ban({ reason: `NEXORA GUARD: ${reason}` });
        } else {
            // Banlanamıyorsa (Rolü yüksekse), en azından timeout at veya bildirim gönder
            await member.timeout(24 * 60 * 60 * 1000, reason).catch(() => { }); // 24 Saat
        }

        // 3. LOG (Konsola ve Log Kanalına)
        console.log(`[GUARD] ${member.user.tag} (${userId}) engellendi! Sebep: ${reason}`);

        // Log kanalı varsa oraya at (LogHelper kullanılabilir)
        // Bu kısım events/ içinde ayrıca handle edilecek.

        return true; // İşlem yapıldı
    } catch (error) {
        console.error('Quarantine error:', error);
        return false;
    }
}
