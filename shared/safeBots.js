// BU DOSYAYA GÜVENLİ (DOST) BOTLARIN ID'LERİNİ GİRİN
// Guard botlar bu listedeki botlara dokunmaz.

const SAFE_BOT_IDS = [
    "1204892900782243840", // Main Bot
    "1464664093096017965", // Custom Bot (User ID)
    "1204894676025344051", // Custom Bot (Client ID)
    "1330545931086303242", // Custom Bot (Eski ID) - Silmiyorum ne olur ne olmaz

    // Diğer Botlar (ID'lerini güncellemek isterseniz buraya ekleyin)
    // Guard Botlar kendi kendilerini zaten executor.id üzerinden tanır ama eklemek zarar vermez
    "1463875324021182536" // Örnek Guild ID veya Diğer Bot ID'si
];

module.exports = SAFE_BOT_IDS;
