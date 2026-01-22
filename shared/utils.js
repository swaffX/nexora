const moment = require('moment');

const utils = {
    // Süre parse etme (1d, 2h, 30m, 1w)
    parseDuration: (str) => {
        const regex = /^(\d+)([smhdw])$/;
        const match = str.match(regex);
        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2];

        const units = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000,
            'w': 7 * 24 * 60 * 60 * 1000
        };

        return value * units[unit];
    },

    // Süre formatlama
    formatDuration: (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} gün`;
        if (hours > 0) return `${hours} saat`;
        if (minutes > 0) return `${minutes} dakika`;
        return `${seconds} saniye`;
    },

    // İsim formatla (ilk harf büyük)
    formatName: (name) => {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },

    // XP'den seviye hesapla
    calculateLevel: (xp) => {
        return Math.floor(0.1 * Math.sqrt(xp));
    },

    // Seviye için gereken XP
    xpForLevel: (level) => {
        return Math.pow(level / 0.1, 2);
    },

    // Random XP (min-max arası)
    randomXP: (min = 15, max = 25) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Sayı formatlama (1000 -> 1K)
    formatNumber: (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    // Hesap yaşı kontrolü (gün cinsinden)
    getAccountAge: (user) => {
        const createdAt = moment(user.createdAt);
        return moment().diff(createdAt, 'days');
    },

    // Zaman damgası
    timestamp: () => moment().format('YYYY-MM-DD HH:mm:ss'),

    // Hafta başlangıcı
    getWeekStart: () => moment().startOf('isoWeek').toDate(),

    // Ay başlangıcı
    getMonthStart: () => moment().startOf('month').toDate(),

    // Gün başlangıcı
    getDayStart: () => moment().startOf('day').toDate(),

    // Cooldown kontrolü
    checkCooldown: (map, key, cooldownMs) => {
        const now = Date.now();
        const cooldownEnd = map.get(key);

        if (cooldownEnd && now < cooldownEnd) {
            return cooldownEnd - now;
        }

        map.set(key, now + cooldownMs);
        return 0;
    },

    // Rastgele renk
    randomColor: () => {
        return Math.floor(Math.random() * 16777215);
    },

    // Progress bar oluştur
    progressBar: (current, max, size = 10) => {
        const percentage = current / max;
        const filled = Math.round(size * percentage);
        const empty = size - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    },

    // Emoji sayılarla
    numberEmoji: (num) => {
        const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        return emojis[num] || num.toString();
    },

    // Üye sayısı formatla
    ordinalize: (n) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    // Permissions kontrolü
    hasPermission: (member, permission) => {
        return member.permissions.has(permission);
    },

    // Sleep fonksiyonu
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // ID mi kontrol
    isSnowflake: (str) => /^\d{17,19}$/.test(str),

    // URL mi kontrol
    isURL: (str) => {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    },

    // Discord invite linki mi
    isDiscordInvite: (str) => {
        return /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[\w-]+/.test(str);
    }
};

module.exports = utils;
