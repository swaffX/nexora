const path = require('path');
const Fuse = require('fuse.js');

/**
 * 🧠 NEXORA BRAIN (Lightweight AI)
 * Basit NLP benzeri fuzzy search ile kullanıcı sorularını yanıtlar.
 */

// Bilgi Tabanı (Bunu ileride veritabanına taşıyabiliriz)
const KNOWLEDGE_BASE = [
    {
        questions: ['maç nasıl kurulur', 'maç oluşturma', 'oyun kurmak istiyorum', '5v5 nasıl atılır'],
        answer: '🛡️ **Maç Kurulumu:**\n5v5 Maç sistemi sadece **Yetkili Ekip** tarafından başlatılabilir. Maç duyurularını takip ederek katılabilirsin!'
    },
    {
        questions: ['kayıt olmak istiyorum', 'nasıl kayıt olunur', 'kayıt sistemi', 'kız rolü al', 'erkek rolü al'],
        answer: '📝 **Kayıt İşlemi:**\nSunucumuzda kayıt sistemi otomatiktir. Kayıt kanalındaki **"Kayıt Ol"** butonuna basman yeterlidir.'
    },
    {
        questions: ['ip adresi', 'sunucu ip', 'ts3 ip', 'bağlanamıyorum'],
        answer: '🌐 **Nexora IP Adresleri:**\nHenüz bir oyun sunucusu IP\'si tanımlanmadı. Sadece Discord üzerinden 5v5 maçlar dönüyor.'
    },
    {
        questions: ['yetkili alımı', 'moderatör olmak istiyorum', 'admin alımı var mı'],
        answer: '🛡️ **Yetkili Alımı:**\nŞu an için alımlar kapalıdır. Aktifliğine göre yönetim seninle iletişime geçecektir.'
    },
    {
        questions: ['destek', 'ticket', 'sorunum var', 'biri küfür etti'],
        answer: '🎫 **Destek Hattı:**\nBir sorun yaşıyorsan Yönetim ekibine DM üzerinden veya genel sohbetten ulaşabilirsin. Ticket sistemi yerini Akıllı Destek\'e bıraktı.'
    },
    {
        questions: ['rank sistemi', 'level sistemi', 'nasıl level atlarım', 'xp kazanma'],
        answer: '📈 **Level Sistemi:**\nSohbette mesaj yazarak ve sesli kanallarda vakit geçirerek XP kazanırsın. `/rank` yazarak seviyeni gör.'
    },
    {
        questions: ['merhaba', 'selam', 'sa', 'selamun aleyküm', 'nbr'],
        answer: '👋 Selam! Ben Nexora Bot. Sana nasıl yardımcı olabilirim?'
    },
    {
        questions: ['bot komutları', 'yardım', 'help', 'neler yapabilirsin'],
        answer: '🤖 **Komut Listesi:**\n🏆 `/tournament` - Turnuva sistemi\n💰 `/daily`, `/coinflip`, `/slots` - Ekonomi oyunları\n📈 `/rank` - Seviyeni gör\n\nVe beni etiketleyip soru sorabilirsin!'
    }
];

// Fuse Ayarları (Hassasiyet)
const options = {
    includeScore: true,
    keys: ['questions'],
    threshold: 0.5, // 0.0 (tam eşleşme) - 1.0 (her şey eşleşir). 0.4-0.5 iyidir.
};

const fuse = new Fuse(KNOWLEDGE_BASE, options);

async function handleMessage(message) {
    // Sadece bot etiketlendiğinde veya "Nexora" dendiğinde çalışsın
    const content = message.content.toLowerCase();
    const isMentioned = message.mentions.has(message.client.user) || content.includes('nexora');

    if (!isMentioned) return;

    // Soruyu temizle (etiketleri ve bot ismini çıkar)
    const cleanQuery = content
        .replace(/<@!?[0-9]+>/g, '')
        .replace('nexora', '')
        .trim();

    if (cleanQuery.length < 2) return; // Çok kısa mesajlara cevap verme

    // Arama Yap
    const result = fuse.search(cleanQuery);

    if (result.length > 0) {
        const bestMatch = result[0];
        // Skora göre güvenilirlik kontrolü (0'a ne kadar yakınsa o kadar iyi)
        if (bestMatch.score < 0.6) {
            await message.reply(bestMatch.item.answer);
        } else {
            // Eşleşme zayıfsa tepki ver
            await message.react('❓');
        }
    } else {
        // Hiçbir şey anlamadıysa
        // await message.reply('🤔 Bunu tam anlayamadım. Biraz daha açık sorabilir misin?'); 
        // (Sessiz kalmak bazen daha iyidir, spam olmasın)
    }
}

module.exports = { handleMessage };
