const { PermissionsBitField } = require('discord.js');
const RankConfig = require('../../../shared/models/RankConfig');

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
    async syncRank(member, newLevel) {
        if (!member || !member.guild || !newLevel) return;

        // 1. HARDCODED ROLLER (User Request)
        const LEVEL_ROLES = {
            1: '1469097452199088169',
            2: '1469097453109383221',
            3: '1469097454979911813',
            4: '1469097456523284500',
            5: '1469097457303687180',
            6: '1469097485514575895',
            7: '1469097487016132810',
            8: '1469097488429355158',
            9: '1469097489457090754',
            10: '1469097490824564747'
        };

        // 2. ZORUNLU KONTROL: Valorant Rolü
        const REQUIRED_VALORANT_ROLE = '1466189076347486268';
        const allLevelRoles = Object.values(LEVEL_ROLES);

        if (!member.roles.cache.has(REQUIRED_VALORANT_ROLE)) {
            // Rolü yoksa, üzerindeki tüm rank rollerini temizle
            const rolesToRemove = member.roles.cache.filter(r => allLevelRoles.includes(r.id));
            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove).catch(() => { });
                console.log(`[RANK SYNC] ${member.user.tag} -> Level Roles Removed (No Valorant Role)`);
            }
            return;
        }

        const targetRoleId = LEVEL_ROLES[newLevel];
        if (!targetRoleId) return;

        // Kaldırılacaklar: Hedef rol hariç diğer tüm level rolleri
        const rolesToRemove = member.roles.cache.filter(r =>
            allLevelRoles.includes(r.id) && r.id !== targetRoleId
        );

        const promises = [];

        // Rolleri kaldır
        if (rolesToRemove.size > 0) {
            promises.push(member.roles.remove(rolesToRemove).catch(e => console.error(`Failed to remove roles for ${member.user.tag}:`, e.message)));
        }

        // Yeni rolü ekle
        if (!member.roles.cache.has(targetRoleId)) {
            promises.push(member.roles.add(targetRoleId).catch(e => console.error(`Failed to add role ${targetRoleId} to ${member.user.tag}:`, e.message)));
        }

        await Promise.all(promises);

        if (rolesToRemove.size > 0 || !member.roles.cache.has(targetRoleId)) {
            console.log(`[RANK SYNC] ${member.user.tag} -> Level ${newLevel} (Roles Updated)`);
        }
    }
};
