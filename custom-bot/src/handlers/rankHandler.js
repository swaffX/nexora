const { PermissionsBitField } = require('discord.js');
const path = require('path');
const RankConfig = require('../../../shared/models/RankConfig');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

// Level rolleri için konfigürasyon (renkler) - Hex Number Format
const LEVEL_COLORS = {
    1: 0xFFFFFF, // Beyaz
    2: 0x00FF00, // Yeşil
    3: 0x00FF00,
    4: 0xFFFF00, // Sarı
    5: 0xFFFF00,
    6: 0xFFFF00,
    7: 0xFFFF00,
    8: 0xFF8800, // Turuncu
    9: 0xFF8800,
    10: 0xFF0000 // Kırmızı
};

module.exports = {
    /**
     * Level'e karşılık gelen rol ismini döndürür
     */
    getRoleName(level) {
        return `Level ${level}`;
    },

    /**
     * Sunucudaki Level rollerini kontrol eder, yoksa oluşturur ve DB'ye kaydeder.
     * @param {Guild} guild 
     */
    async ensureRolesExist(guild) {
        if (!guild) return;

        // Configi çek
        let config = await RankConfig.findOne({ guildId: guild.id });
        if (!config) {
            config = new RankConfig({ guildId: guild.id, roles: [] });
        }

        const rolesMap = {}; // level -> roleId
        config.roles.forEach(r => rolesMap[r.level] = r.roleId);

        let rolesUpdated = false;

        // 1. Rolleri Kontrol Et / Oluştur (Sırayla 1..10)
        for (let i = 1; i <= 10; i++) {
            const roleName = this.getRoleName(i);
            const savedRoleId = rolesMap[i];

            let role = null;
            if (savedRoleId) {
                role = guild.roles.cache.get(savedRoleId);
            }

            // Eğer rol yoksa
            if (!role) {
                role = guild.roles.cache.find(r => r.name === roleName);

                if (!role) {
                    try {
                        console.log(`Creating missing rank role: ${roleName}`);
                        role = await guild.roles.create({
                            name: roleName,
                            color: LEVEL_COLORS[i] || 0xFFFFFF,
                            reason: 'Nexora Rank System Auto-Setup',
                            hoist: true
                        });
                    } catch (e) {
                        console.error(`Failed to create role ${roleName}:`, e.message);
                    }
                }
            }

            if (role) {
                rolesMap[i] = role.id;

                // Config güncelle
                const existingIndex = config.roles.findIndex(r => r.level === i);
                if (existingIndex >= 0) {
                    if (config.roles[existingIndex].roleId !== role.id) {
                        config.roles[existingIndex].roleId = role.id;
                        rolesUpdated = true;
                    }
                } else {
                    config.roles.push({ level: i, roleId: role.id });
                    rolesUpdated = true;
                }
            }
        }

        if (rolesUpdated) {
            await config.save();
            console.log('Rank roles configuration saved to database.');
        }

        return rolesMap;
    },

    /**
     * Üyenin rank rolünü günceller (Veritabanından ID alır)
     */
    /**
     * Üyenin rank rolünü günceller (Veritabanından ID alır)
     */
    async syncRank(member, newLevel) {
        if (!member || !member.guild || !newLevel) return;

        // Rolleri veritabanından/cache'den al (Hardcoded ID'lerden kurtulduk)
        // ensureRolesExist zaten mevcut ID'leri döndürür veya oluşturur
        const rolesMap = await this.ensureRolesExist(member.guild);

        if (!rolesMap) {
            console.error('[RankHandler] Roller yüklenemedi, sync iptal.');
            return;
        }

        const REQUIRED_VALORANT_ROLE = '1466189076347486268'; // Bu rol ID'si sabit (Giriş rolü)
        const ALL_LEVEL_ROLE_IDS = Object.values(rolesMap);
        const targetRoleId = rolesMap[newLevel];

        // 1. Üye sunucuda değilse veya Valorant rolü yoksa tüm level rollerini sil
        if (!member.roles.cache.has(REQUIRED_VALORANT_ROLE)) {
            const hasAny = member.roles.cache.filter(r => ALL_LEVEL_ROLE_IDS.includes(r.id));
            if (hasAny.size > 0) await member.roles.remove(hasAny).catch(() => { });
            return;
        }

        // 2. Yanlış olan tüm level rollerini tespit et
        const rolesToRemove = member.roles.cache.filter(r => ALL_LEVEL_ROLE_IDS.includes(r.id) && r.id !== targetRoleId);
        const hasTarget = member.roles.cache.has(targetRoleId);

        // 3. Değişiklik Gerekiyorsa Uygula
        if (rolesToRemove.size > 0 || !hasTarget) {
            try {
                // Get all current roles IDs
                let currentRoleIds = Array.from(member.roles.cache.keys());

                // Cleanup level roles
                currentRoleIds = currentRoleIds.filter(id => !ALL_LEVEL_ROLE_IDS.includes(id));

                // Add target level role
                if (targetRoleId) currentRoleIds.push(targetRoleId);

                console.log(`[SYNC-ATTEMPT] ${member.user.tag} -> Target Level: ${newLevel}`);

                await member.roles.set(currentRoleIds, `Auto Rank Update: Level ${newLevel}`);

                logger.success(`[SYNC-SUCCESS] ${member.user.tag} artık Level ${newLevel} (${this.getRoleName(newLevel)}).`);
            } catch (e) {
                logger.error(`[SYNC-ERROR] ${member.user.tag} işlemi başarısız: ${e.message}`);
                if (e.message.includes('Missing Permissions')) {
                    logger.error('!!! BOTUN YETKİSİ YETMİYOR. "Nexora Custom" rolünü Discord ayarlarından en üste çekin !!!');
                }
            }
        }
    }
};
