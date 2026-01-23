module.exports = {
    JOBS: {
        'developer': {
            name: 'Yazılımcı',
            emoji: '💻',
            description: 'Kod yazarak sistemler geliştirir.',
            baseSalary: 1500, // Başlangıç maaşı
            multiplier: 1.2, // Seviye başına artış oranı
            maxLevel: 10
        },
        'doctor': {
            name: 'Doktor',
            emoji: '⚕️',
            description: 'Hastaları iyileştirir ve hayat kurtarır.',
            baseSalary: 1800,
            multiplier: 1.15,
            maxLevel: 10
        },
        'banker': {
            name: 'Bankacı',
            emoji: '💰',
            description: 'Finansal işlemleri yönetir.',
            baseSalary: 1600,
            multiplier: 1.18,
            maxLevel: 10
        },
        'chef': {
            name: 'Şef',
            emoji: '👨‍🍳',
            description: 'Lezzetli yemekler yapar.',
            baseSalary: 1200,
            multiplier: 1.25, // Düşük maaş ama hızlı artış
            maxLevel: 10
        },
        'streamer': {
            name: 'Yayıncı',
            emoji: '🎥',
            description: 'Canlı yayın yaparak topluluğu eğlendirir.',
            baseSalary: 1000,
            multiplier: 1.3, // Riskli ama yüksek potansiyel
            maxLevel: 10
        },
        'police': {
            name: 'Polis',
            emoji: '👮',
            description: 'Şehrin güvenliğini sağlar.',
            baseSalary: 1400,
            multiplier: 1.2,
            maxLevel: 10
        }
    },

    // Maaş Hesaplama: Base * (Multiplier ^ (Level - 1))
    calculateSalary: (jobId, level) => {
        const job = module.exports.JOBS[jobId];
        if (!job) return 0;
        return Math.floor(job.baseSalary * Math.pow(job.multiplier, level - 1));
    },

    // Seviye Atlamak için gereken XP: 100 * Level
    requiredXP: (level) => {
        return level * 100;
    }
};
