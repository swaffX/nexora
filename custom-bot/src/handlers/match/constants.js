const path = require('path');
const { GlobalFonts } = require('@napi-rs/canvas');

// Font Register (Sadece bir kez çalışmalı ama burada dursun)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) { }

const MAPS = [
    { name: 'Abyss', file: 'Abyss.png' },
    { name: 'Ascent', file: 'Ascent.png' },
    { name: 'Bind', file: 'Bind.png' },
    { name: 'Breeze', file: 'Breeze.png' },
    { name: 'Corrode', file: 'Corrode.png' },
    { name: 'Fracture', file: 'Fracture.png' },
    { name: 'Haven', file: 'Haven.png' },
    { name: 'Icebox', file: 'Icebox.png' },
    { name: 'Lotus', file: 'Lotus.png' },
    { name: 'Pearl', file: 'Pearl.png' },
    { name: 'Split', file: 'Split.png' },
    { name: 'Sunset', file: 'Sunset.png' }
];


// Ana lobi (her zaman aktif)
const MAIN_LOBBY = {
    id: 'main',
    name: 'Ana Lobi',
    voiceId: '1469371485855547587', // Lobi Bekleme kanalı (güncel)
    categoryId: '1463883244436197397', // COMPETITIVE kategorisi
    setupChannelId: '1469371484739866889' // maç-panel kanalı (güncel)
};

// Ek lobiler (admin tarafından açılabilir)
const ADDITIONAL_LOBBIES = {
    2: {
        id: 2,
        name: 'Lobby 2',
        voiceId: null, // Dinamik oluşturulacak
        categoryId: null, // Dinamik oluşturulacak
        setupChannelId: null, // Dinamik oluşturulacak
        enabled: false // Varsayılan kapalı
    },
    3: {
        id: 3,
        name: 'Lobby 3',
        voiceId: null,
        categoryId: null,
        setupChannelId: null,
        enabled: false
    }
};

// Geriye dönük uyumluluk için eski LOBBY_CONFIG
const LOBBY_CONFIG = {
    1: MAIN_LOBBY,
    main: MAIN_LOBBY,
    ...ADDITIONAL_LOBBIES
};

const BLOCKED_ROLE_ID = '1463875341553635553';

module.exports = {
    MAPS,
    LOBBY_CONFIG,
    MAIN_LOBBY,
    ADDITIONAL_LOBBIES,
    BLOCKED_ROLE_ID,
    getLobbyConfig: (lobbyId) => LOBBY_CONFIG[lobbyId] || LOBBY_CONFIG['main'],
    getLobbyBySetupChannel: (channelId) => Object.values(LOBBY_CONFIG).find(l => l.setupChannelId === channelId),
    getActiveLobby: () => MAIN_LOBBY, // Ana lobi her zaman aktif
    isLobbyEnabled: (lobbyId) => {
        if (lobbyId === 'main' || lobbyId === 1) return true;
        return ADDITIONAL_LOBBIES[lobbyId]?.enabled || false;
    }
};
