const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Resmi Valorant Harita Görselleri
const MAPS = {
    'Ascent': 'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
    'Bind': 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png',
    'Haven': 'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png',
    'Split': 'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png',
    'Icebox': 'https://media.valorant-api.com/maps/e024ee61-4d06-9bff-b968-7b9e293a3519/splash.png',
    'Breeze': 'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png',
    'Fracture': 'https://media.valorant-api.com/maps/b529448b-4d84-ecb4-9749-1e927a080fc2/splash.png',
    'Pearl': 'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png',
    'Lotus': 'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png',
    'Sunset': 'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png',
    'Abyss': 'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1a86-c27803146b6d/splash.png'
};

function applyRoundImage(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
}

async function createLobbyImage(teamA, teamB, bgMapName = 'Abyss', nameA = 'TEAM A', nameB = 'TEAM B') {
    const width = 1000;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Arkaplan
    let bg = null;
    try {
        // Önce local assets'ten yükle
        const fs = require('fs');
        const path = require('path');
        const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
        let mapPath = path.join(assetsPath, `${bgMapName}.png`);
        if (!fs.existsSync(mapPath)) {
            mapPath = path.join(assetsPath, `${bgMapName.toLowerCase()}.png`);
        }
        
        if (fs.existsSync(mapPath)) {
            bg = await loadImage(mapPath);
        } else {
            // Fallback: API'den yükle (hata olursa sessiz geç)
            const mapUrl = MAPS[bgMapName] || MAPS['Abyss'];
            bg = await loadImage(mapUrl).catch(() => null);
        }
    } catch (e) {
        console.error('Map image load error:', e.message);
        bg = null;
    }
    
    if (bg) {
        ctx.filter = 'blur(3px) brightness(0.4)';
        ctx.drawImage(bg, 0, 0, width, height);
        ctx.filter = 'none';

        // Harita Adı (Arkaplanda silik)
        ctx.font = 'bold 150px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.textAlign = 'center';
        ctx.fillText(bgMapName.toUpperCase(), width / 2, height / 2 + 50);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
    }

    // VS Logo (Ortaya)
    ctx.fillStyle = '#ff4655';
    ctx.font = 'bold 80px sans-serif'; // Valorant fontu yoksa sans
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 20;
    ctx.fillText('VS', width / 2, height / 2 + 20);
    ctx.shadowBlur = 0;

    // Team A (Sol - Mavi)
    await drawTeam(ctx, teamA, 50, 100, '#3b82f6', nameA);

    // Team B (Sağ - Kırmızı)
    await drawTeam(ctx, teamB, 550, 100, '#ff4655', nameB);

    return canvas.encode('png');
}

async function drawTeam(ctx, players, x, y, color, teamName) {
    // Başlık
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 50, 400, 5); // Çizgi

    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(teamName, x, y - 10);

    let curY = y + 20;
    for (const player of players) {
        // Kart Arka Planı
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, curY, 400, 70);

        // Sol şerit
        ctx.fillStyle = color;
        ctx.fillRect(x, curY, 5, 70);

        // Avatar
        try {
            const avatar = await loadImage(player.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png');
            ctx.save();
            applyRoundImage(ctx, x + 20, curY + 10, 50);
            ctx.drawImage(avatar, x + 20, curY + 10, 50, 50);
            ctx.restore();
        } catch (e) { }

        // İsim
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(player.username?.substring(0, 15), x + 85, curY + 45);

        curY += 80;
    }
}

async function createVoteResultImage(allMapNames, votes) { // votes: { 'Ascent': 3, 'Bind': 1 }
    const width = 1200;
    const height = 700;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Arkaplan
    ctx.fillStyle = '#0f1923';
    ctx.fillRect(0, 0, width, height);

    // Başlık
    ctx.font = 'bold 50px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('MAP VOTING RESULTS', width / 2, 70);

    let x = 50;
    let y = 130;
    const cardW = 250;
    const cardH = 140;

    // Harita Listesi (Alfabetik veya sabit sıra)
    const mapList = Object.keys(MAPS); // Yada parametre olarak gelen

    // En çok oy alanı bul (Yeşil işaretlemek için)
    let maxVotes = -1;
    let winnerMap = null;
    let tie = false;

    // Vote datasını işle
    // votes = { 'Ascent': 5, 'Bind': 2 }
    Object.entries(votes).forEach(([m, c]) => {
        if (c > maxVotes) { maxVotes = c; winnerMap = m; tie = false; }
        else if (c === maxVotes) { tie = true; } // Beraberlik durumu
    });

    // Eğer oy yoksa kazanan yok
    if (Object.keys(votes).length === 0) winnerMap = null;
    // Beraberlik varsa kazananı görsel olarak vurgulama (veya ikisini de vurgula)

    for (const mapName of allMapNames) {
        const voteCount = votes[mapName] || 0;
        // Eğer oylama bitmişse ve kazanan bu ise (beraberlik yoksa)
        const isWinner = (winnerMap === mapName && !tie && maxVotes > 0);

        // Resim
        let img = null;
        try {
            // Önce local assets'ten yükle
            const fs = require('fs');
            const path = require('path');
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let mapPath = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(mapPath)) {
                mapPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);
            }
            
            if (fs.existsSync(mapPath)) {
                img = await loadImage(mapPath);
            } else {
                // Fallback: API'den yükle (hata olursa sessiz geç)
                img = await loadImage(MAPS[mapName]).catch(() => null);
            }
        } catch (e) {
            img = null;
        }
        
        if (img) {
            ctx.save();
            // Kazanan belli ise diğerlerini karart
            if (winnerMap && !isWinner && !tie) ctx.filter = 'grayscale(100%) brightness(0.4)';

            ctx.drawImage(img, x, y, cardW, cardH);
            ctx.restore();
        } else {
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, cardW, cardH);
        }

        // Çerçeve (Kazanan)
        if (isWinner) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 5;
            ctx.strokeRect(x, y, cardW, cardH);
        }

        // Oy Sayısı Barı
        const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
        const percent = totalVotes > 0 ? (voteCount / totalVotes) : 0;

        // Bar Arkaplan
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y + cardH + 5, cardW, 10);
        // Bar Doluluk
        ctx.fillStyle = isWinner ? '#00ff00' : '#ff4655';
        ctx.fillRect(x, y + cardH + 5, cardW * percent, 10);

        // İsim ve Sayı
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${mapName}`, x + cardW / 2, y + cardH + 35);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText(`${voteCount} Oy`, x + cardW / 2, y + cardH + 55);

        x += cardW + 30;
        if (x > width - cardW) { x = 50; y += cardH + 70; }
    }

    return canvas.encode('png');
}

module.exports = { createLobbyImage, createVoteResultImage };
