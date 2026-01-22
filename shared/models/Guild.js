const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    odaId: { type: String, required: true, unique: true }, // Sunucu ID

    // Welcome/Goodbye Ayarları
    welcome: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: 'Sunucumuza hoş geldin {user}!' },
        dmEnabled: { type: Boolean, default: false },
        dmMessage: { type: String, default: '{server} sunucusuna hoş geldin!' }
    },
    goodbye: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: '{user} sunucudan ayrıldı.' }
    },

    // Kayıt Sistemi Ayarları
    register: {
        enabled: { type: Boolean, default: false },
        verifyChannelId: { type: String, default: null }, // Butonlu kayıt kanalı
        logChannelId: { type: String, default: null },
        maleRoleId: { type: String, default: null },
        femaleRoleId: { type: String, default: null },
        unregisteredRoleId: { type: String, default: null },
        registeredRoleId: { type: String, default: null },
        nameFormat: { type: String, default: '{isim}' },
        staffRoles: [{ type: String }],
        chatChannelId: { type: String, default: null }
    },

    // İstatistikler (Kişi Sayacı vb.)
    stats: {
        memberCountChannelId: { type: String, default: null }
    },

    // Level Sistemi Ayarları
    levelSystem: {
        enabled: { type: Boolean, default: false },
        logChannelId: { type: String, default: null },
        leaderboardChannelId: { type: String, default: null },
        leaderboardMessageId: { type: String, default: null },
        multiplier: { type: Number, default: 1 },
        cardBackground: { type: String, default: null },
        roleRewards: [{
            level: { type: Number },
            roleId: { type: String }
        }]
    },

    // Moderasyon/Guard Ayarları
    guard: {
        enabled: { type: Boolean, default: true },
        logChannelId: { type: String, default: null },

        // Limitler
        roleCreateLimit: { type: Number, default: 3 },
        roleDeleteLimit: { type: Number, default: 3 },
        channelCreateLimit: { type: Number, default: 3 },
        channelDeleteLimit: { type: Number, default: 3 },
        banLimit: { type: Number, default: 3 },
        kickLimit: { type: Number, default: 3 },

        // Beyaz liste
        whitelist: [{ type: String }],

        // Spam koruması
        antiSpam: { type: Boolean, default: true },
        antiCaps: { type: Boolean, default: false },
        antiLink: { type: Boolean, default: true },
        antiInvite: { type: Boolean, default: true }
    },

    // Otorol
    autoRole: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String, default: null },
        logChannelId: { type: String, default: null }
    },

    // CAPTCHA Ayarları
    captcha: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        verifiedRoleId: { type: String, default: null },
        timeout: { type: Number, default: 300000 }  // 5 dakika
    },

    // Invite Tracker Ayarları
    inviteTracker: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        fakeAccountAge: { type: Number, default: 7 },  // 7 günden yeni = fake
        rewards: [{
            invites: { type: Number },
            roleId: { type: String }
        }]
    },

    // Ticket Ayarları
    ticket: {
        enabled: { type: Boolean, default: false },
        categoryId: { type: String, default: null },
        logChannelId: { type: String, default: null },
        count: { type: Number, default: 0 }, // Ticket sayacı
        supportRoles: [{ type: String }],
        welcomeMessage: { type: String, default: 'Merhaba! Destek talebiniz oluşturuldu. Lütfen sorununuzu açıklayın.' },
        categories: [{
            name: { type: String },
            emoji: { type: String },
            roles: [{ type: String }]
        }]
    },

    // Valorant Rank-Rol Eşleşmeleri
    valorantRoles: {
        Iron: { type: String, default: null },
        Bronze: { type: String, default: null },
        Silver: { type: String, default: null },
        Gold: { type: String, default: null },
        Platinum: { type: String, default: null },
        Diamond: { type: String, default: null },
        Ascendant: { type: String, default: null },
        Immortal: { type: String, default: null },
        Radiant: { type: String, default: null }
    },

    // Log Kanalları (YENİ EKLENDİ)
    logs: {
        enabled: { type: Boolean, default: true },
        message: { type: String, default: null }, // message-logs
        member: { type: String, default: null },  // member-logs
        moderation: { type: String, default: null }, // mod-logs (eski guard log)
        role: { type: String, default: null },    // role-logs
        channel: { type: String, default: null }, // channel-logs
        voice: { type: String, default: null },   // voice-logs
        server: { type: String, default: null }   // server-logs
    },

    // Giveaway Ayarları (Basit)
    giveaway: {
        managerRoleId: { type: String, default: null }
    },

    // Özel Komutlar (Basit metin cevabı)
    customCommands: [{
        trigger: { type: String, required: true },
        response: { type: String, required: true }
    }]

}, { timestamps: true });

// Static methods
guildSchema.statics.findOrCreate = async function (guildId, guildName = null) {
    let guild = await this.findOne({ odaId: guildId });
    if (!guild) {
        guild = await this.create({
            odaId: guildId,
            welcome: { enabled: false }, // Default ayarlar
        });
    }
    return guild;
};

module.exports = mongoose.model('Guild', guildSchema);
