const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Model path'i shared içinde normalde. Relative path ayarlayalım.
// custom-bot root'undayız. shared ../shared
const MatchModel = require('../shared/models/Match');

async function fixMatchCount() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const guildId = '1463868666360631337'; // Nexora Guild ID (Step 1'den user info'da yok ama loglarda gördüm sanki veya User'ın odaId'si)
        // Kullanıcının attığı ID bir mesaj ID'si. Guild ID'yi bilmiyorum.
        // Ama Match.findOne boş query ile de çalışır veya en son maçı bulurum.

        // En yüksek numaralı maçı bul
        const lastMatch = await MatchModel.findOne().sort({ matchNumber: -1 });
        console.log('Last Match Number:', lastMatch ? lastMatch.matchNumber : 'None');

        if (lastMatch && lastMatch.matchNumber > 38) {
            console.log(`Deleting matches with matchNumber > 38...`);
            const result = await MatchModel.deleteMany({ matchNumber: { $gt: 38 } });
            console.log(`Deleted ${result.deletedCount} matches.`);

            // Kontrol
            const newLast = await MatchModel.findOne().sort({ matchNumber: -1 });
            console.log('New Last Match Number:', newLast ? newLast.matchNumber : 'None');
            console.log('Next match will be:', newLast ? newLast.matchNumber + 1 : 1);
        } else {
            console.log('No matches found > 38. Nothing to do.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fixMatchCount();
