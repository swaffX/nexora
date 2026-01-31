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

let MATCH_CATEGORY_ID = '1463883244436197397';

module.exports = {
    MAPS,
    MATCH_CATEGORY_ID,
    getCategoryId: () => MATCH_CATEGORY_ID,
    setCategoryId: (id) => { MATCH_CATEGORY_ID = id; }
};
