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


const LOBBY_CONFIG = {
    1: {
        id: 1,
        name: 'Lobby 1',
        voiceId: '1463922466467483801',
        categoryId: '1463883244436197397',
        setupChannelId: '1464222855398166612'
    },
    2: {
        id: 2,
        name: 'Lobby 2',
        voiceId: '1467987380530184194',
        categoryId: '1467987284623233218',
        setupChannelId: '1467987345461743638'
    },
    3: {
        id: 3,
        name: 'Lobby 3',
        voiceId: '1467987533039403119',
        categoryId: '1467987452039004346',
        setupChannelId: '1467987505792946196'
    }
};

const BLOCKED_ROLE_ID = '1463875341553635553';

module.exports = {
    MAPS,
    LOBBY_CONFIG,
    BLOCKED_ROLE_ID,
    getLobbyConfig: (lobbyId) => LOBBY_CONFIG[lobbyId],
    getLobbyBySetupChannel: (channelId) => Object.values(LOBBY_CONFIG).find(l => l.setupChannelId === channelId)
};
