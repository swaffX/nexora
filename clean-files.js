const fs = require('fs');
const path = require('path');

const mainCmdPath = path.join(__dirname, 'main-bot', 'src', 'commands');

// 1. Gereksiz Klasörleri Sil
const foldersToDelete = ['ticket', 'utility', 'invite'];
// Giveaway kalsın mı? Kullanıcı 'gereksiz' dedi. Belki kalsın, zararı yok.
// Ticket kesin silinsin. Utility kesin silinsin (ping, avatar vb). Invite silinsin.

foldersToDelete.forEach(folder => {
    const p = path.join(mainCmdPath, folder);
    if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`🗑️ Klasör silindi: ${folder}`);
    }
});

// 2. Register Temizliği (Eski sistem)
const registerPath = path.join(mainCmdPath, 'register');
if (fs.existsSync(registerPath)) {
    const files = fs.readdirSync(registerPath);
    files.forEach(f => {
        if (f !== 'setup-verify.js' && f !== 'unregister.js') { // setup-verify kalsın. unregister da lazım olabilir.
            fs.unlinkSync(path.join(registerPath, f));
            console.log(`🗑️ Dosya silindi: register/${f}`);
        }
    });
}

// 3. Moderation Temizliği
const modPath = path.join(mainCmdPath, 'moderation');
if (fs.existsSync(modPath)) {
    const files = fs.readdirSync(modPath);
    files.forEach(f => {
        if (f.includes('mass')) { // massrole, massban vb.
            fs.unlinkSync(path.join(modPath, f));
            console.log(`🗑️ Dosya silindi: moderation/${f}`);
        }
    });
}

console.log('✅ Dosya temizliği tamamlandı.');
