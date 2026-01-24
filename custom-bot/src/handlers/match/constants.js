const path = require('path');
const { GlobalFonts } = require('@napi-rs/canvas');

// Font Register (Sadece bir kez çalışmalı ama burada dursun)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) { }

const MAPS = [
    { name: 'Abyss', img: 'https://cdn.mobalytics.gg/assets/valorant/images/maps/abyss-preview.png' },
    { name: 'Ascent', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt72ffc2b11ce3444e/5ebc4706977e4952089b0d38/Ascent_KeyArt.jpg' },
    { name: 'Bind', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt2253df64b2257d0d/5ebc4709d7dfae47672bb7e5/Bind_KeyArt.jpg' },
    { name: 'Breeze', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt25b597c9b0e9f1a2/607f2d5e324ef564756c9a96/Breeze_KeyArt.jpg' },
    { name: 'Fracture', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt910a34b223d7729f/6132717f9e830e0a5523a763/Fracture_KeyArt.jpg' },
    { name: 'Haven', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt5ebb68641a27e78e/5ebc470659a584346bcce209/Haven_KeyArt.jpg' },
    { name: 'Icebox', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt734914c995f92276/5f72782bcfb4685ff87e141a/Icebox_KeyArt.jpg' },
    { name: 'Lotus', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt43d9b4b0e77d2424/63ac73679f043b79ce459d4c/Lotus_KeyArt.jpg' },
    { name: 'Pearl', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltcf0472472d4220b3/62a245d820b8f4477813a408/Pearl_KeyArt.jpg' },
    { name: 'Split', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/bltd184c96825c317aa/5ebc47087617ca35520e5c26/Split_KeyArt.jpg' },
    { name: 'Sunset', img: 'https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt9759d58ac91316b1/64e7d77b8118029519343337/Sunset_KeyArt.jpg' }
];

let MATCH_CATEGORY_ID = '1463883244436197397';

module.exports = {
    MAPS,
    MATCH_CATEGORY_ID,
    getCategoryId: () => MATCH_CATEGORY_ID,
    setCategoryId: (id) => { MATCH_CATEGORY_ID = id; }
};
