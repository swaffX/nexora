const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Eğer URI gelmediyse bir üst dizine bak (VPS yapısı için)
if (!process.env.MONGODB_URI) {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

console.log('MongoDB URI Status:', process.env.MONGODB_URI ? 'Loaded' : '⚠️ NOT FOUND');

// Model path'i shared içinde normalde. Relative path ayarlayalım.
// custom-bot root'undayız. shared ../shared
const MatchModel = require('../shared/models/Match');

async function fixMatchCount() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        // Bağlantı açık mı?
        if (mongoose.connection.readyState === 1) {
            console.log('✅ Connected to DB successfully.');
        } else {
            console.log('⏳ Waiting for connection ready state...');
            await new Promise(resolve => {
                mongoose.connection.once('open', () => {
                    console.log('✅ DB Connected (Event)');
                    resolve();
                });
            });
        }

        console.log(`Checking matches collection...`);

        const guildId = '1463868666360631337';

        // En yüksek numaralı maçı bul
        const lastMatch = await MatchModel.findOne({}).sort({ matchNumber: -1 }).maxTimeMS(20000); // 20sn timeout
        console.log('Last Match Number found:', lastMatch ? lastMatch.matchNumber : 'None');

        if (lastMatch && lastMatch.matchNumber > 38) {
            console.log(`Deleting matches with matchNumber > 38...`);
            const result = await MatchModel.deleteMany({ matchNumber: { $gt: 38 } });
            console.log(`Deleted ${result.deletedCount} matches.`);

            // Kontrol
            const newLast = await MatchModel.findOne({}).sort({ matchNumber: -1 });
            console.log('New Last Match Number:', newLast ? newLast.matchNumber : 'None');
            console.log('Next match will be:', newLast ? newLast.matchNumber + 1 : 1);
        } else {
            console.log('No matches found > 38. Nothing to do.');
        }

    } catch (e) {
        console.error('SCRIPT ERROR:', e);
    } finally {
        console.log('Closing connection...');
        await mongoose.disconnect();
        console.log('Done.');
    }
}

fixMatchCount();
