const axios = require('axios');

// Valdle.gg tarzı oyun için API'de olmayan ek bilgiler (Manuel Tanımlama)
// Bu veriler Classic (Wordle) modu için gereklidir.
const AGENT_METADATA = {
    'Brimstone': { gender: 'Male', species: 'Human', range: 'Controller', release: 'Beta', region: 'USA' },
    'Viper': { gender: 'Female', species: 'Human', range: 'Controller', release: 'Beta', region: 'USA' },
    'Omen': { gender: 'Male', species: 'Radiant', range: 'Controller', release: 'Beta', region: 'Unknown' },
    'Killjoy': { gender: 'Female', species: 'Human', range: 'Sentinel', release: '2020', region: 'Germany' },
    'Cypher': { gender: 'Male', species: 'Human', range: 'Sentinel', release: 'Beta', region: 'Morocco' },
    'Sova': { gender: 'Male', species: 'Human', range: 'Initiator', release: 'Beta', region: 'Russia' },
    'Sage': { gender: 'Female', species: 'Radiant', range: 'Sentinel', release: 'Beta', region: 'China' },
    'Phoenix': { gender: 'Male', species: 'Radiant', range: 'Duelist', release: 'Beta', region: 'UK' },
    'Jett': { gender: 'Female', species: 'Radiant', range: 'Duelist', release: 'Beta', region: 'South Korea' },
    'Reyna': { gender: 'Female', species: 'Radiant', range: 'Duelist', release: '2020', region: 'Mexico' },
    'Raze': { gender: 'Female', species: 'Human', range: 'Duelist', release: 'Beta', region: 'Brazil' },
    'Breach': { gender: 'Male', species: 'Human', range: 'Initiator', release: 'Beta', region: 'Sweden' },
    'Skye': { gender: 'Female', species: 'Radiant', range: 'Initiator', release: '2020', region: 'Australia' },
    'Yoru': { gender: 'Male', species: 'Radiant', range: 'Duelist', release: '2021', region: 'Japan' },
    'Astra': { gender: 'Female', species: 'Radiant', range: 'Controller', release: '2021', region: 'Ghana' },
    'KAY/O': { gender: 'None', species: 'Robot', range: 'Initiator', release: '2021', region: 'Alternate Earth' },
    'Chamber': { gender: 'Male', species: 'Human', range: 'Sentinel', release: '2021', region: 'France' },
    'Neon': { gender: 'Female', species: 'Radiant', range: 'Duelist', release: '2022', region: 'Philippines' },
    'Fade': { gender: 'Female', species: 'Radiant', range: 'Initiator', release: '2022', region: 'Turkey' },
    'Harbor': { gender: 'Male', species: 'Human', range: 'Controller', release: '2022', region: 'India' },
    'Gekko': { gender: 'Male', species: 'Human', range: 'Initiator', release: '2023', region: 'USA' },
    'Deadlock': { gender: 'Female', species: 'Human', range: 'Sentinel', release: '2023', region: 'Norway' },
    'Iso': { gender: 'Male', species: 'Radiant', range: 'Duelist', release: '2023', region: 'China' },
    'Clove': { gender: 'Non-Binary', species: 'Radiant', range: 'Controller', release: '2024', region: 'Scotland' },
    'Vyse': { gender: 'Female', species: 'Radiant', range: 'Sentinel', release: '2024', region: 'Unknown' }, // Yeni
    'Tejo': { gender: 'Male', species: 'Human', range: 'Initiator', release: '2025', region: 'Colombia' } // Varsayım
};

class ValorantService {
    constructor() {
        this.agents = [];
        this.weapons = [];
        this.maps = [];
        this.lastFetch = 0;
    }

    async fetchData() {
        const now = Date.now();
        // 24 Saatte bir yenile (Cache)
        if (this.agents.length > 0 && now - this.lastFetch < 86400000) {
            return;
        }

        try {
            console.log('[ValorantService] Veriler API\'den çekiliyor...');

            // 1. Ajanlar
            const agentRes = await axios.get('https://valorant-api.com/v1/agents?language=tr-TR&isPlayableCharacter=true');
            this.agents = agentRes.data.data.map(agent => ({
                uuid: agent.uuid,
                name: agent.displayName,
                role: agent.role?.displayName || 'Unknown',
                description: agent.description,
                icon: agent.displayIcon,
                bust: agent.bustPortrait || agent.fullPortrait,
                abilities: agent.abilities.filter(a => a.slot !== 'Passive').map(a => ({
                    name: a.displayName,
                    icon: a.displayIcon
                })),
                // Metadata ekle
                meta: AGENT_METADATA[agent.displayName] || { gender: '?', species: '?', region: '?', release: '?' }
            }));

            // 2. Silahlar
            const weaponRes = await axios.get('https://valorant-api.com/v1/weapons?language=tr-TR');
            this.weapons = weaponRes.data.data.map(w => ({
                uuid: w.uuid,
                name: w.displayName,
                category: w.shopData?.categoryText || 'Melee',
                icon: w.displayIcon,
                skins: w.skins.filter(s => s.displayIcon && !s.displayName.includes('Standart')).map(s => ({
                    name: s.displayName,
                    icon: s.displayIcon
                }))
            }));

            // 3. Haritalar
            const mapRes = await axios.get('https://valorant-api.com/v1/maps?language=tr-TR');
            this.maps = mapRes.data.data.filter(m => m.callouts && m.callouts.length > 0).map(m => ({ // Sadece playable haritalar (Callout verisi olanlar genelde playable)
                uuid: m.uuid,
                name: m.displayName,
                splash: m.splash, // Yükleme ekranı (Tam resim)
                displayIcon: m.displayIcon // Minimap
            }));

            this.lastFetch = now;
            console.log(`[ValorantService] Hazır! ${this.agents.length} Ajan, ${this.weapons.length} Silah, ${this.maps.length} Harita.`);

        } catch (err) {
            console.error('[ValorantService] Veri çekme hatası:', err.message);
        }
    }

    getRandomAgent() {
        return this.agents[Math.floor(Math.random() * this.agents.length)];
    }

    getRandomWeapon() {
        // Rastgele bir silah seç, sonra onun rastgele bir skinini seç
        // Amaç: Bazen düz siyah silah değil, direkt skini sormak
        const weapon = this.weapons[Math.floor(Math.random() * this.weapons.length)];
        // %30 ihtimalle skin sor, %70 ihtimalle pure silah sor (veya tam tersi) -> Veya direkt silah sor.
        // Valdle Weapon modu genelde silahın kendini sorar (silüet). Ama skin modu da var.
        // Biz "Silah Tahmini" yapalım.
        return weapon;
    }

    getRandomAbility() {
        const agent = this.getRandomAgent();
        const ability = agent.abilities[Math.floor(Math.random() * agent.abilities.length)];
        return { agentName: agent.name, abilityName: ability.name, icon: ability.icon };
    }

    getRandomMap() {
        return this.maps[Math.floor(Math.random() * this.maps.length)];
    }

    // Classic Modu İçin Karşılaştırma
    checkAgentGuess(targetAgentName, guessAgentName) {
        const target = this.agents.find(a => a.name.toLowerCase() === targetAgentName.toLowerCase());
        const guess = this.agents.find(a => a.name.toLowerCase() === guessAgentName.toLowerCase());

        if (!target || !guess) return null;

        return {
            name: { value: guess.name, match: guess.name === target.name },
            gender: { value: guess.meta.gender, match: guess.meta.gender === target.meta.gender },
            species: { value: guess.meta.species, match: guess.meta.species === target.meta.species },
            role: { value: guess.role, match: guess.role === target.role },
            region: { value: guess.meta.region, match: guess.meta.region === target.meta.region },
            release: { value: guess.meta.release, match: guess.meta.release === target.meta.release } // Yıl karşılaştırması detaylı yapılabilir (önce/sonra)
        };
    }
}

module.exports = new ValorantService();
