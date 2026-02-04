const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixEloNative() {
    console.log('------------------------------------------------');
    console.log('Starting Native MongoDB Fix...');

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI missing.');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB (Native)...');
        await client.connect();
        console.log('✅ Connected.');

        const db = client.db('nexora'); // Veritabanı adı URI'de yoksa burayı kontrol et
        const usersCollection = db.collection('users'); // Mongoose 'User' model -> 'users' collection (küçük harf çoğul) yapar genelde

        console.log('🔄 Running Update...');

        // matchStats.elo >= 150 OLANLARI BUL VE GÜNCELLE
        // matchStats nesnesinin içindeki alanları hedefliyoruz
        const filter = {
            $or: [
                { 'matchStats.elo': { $gte: 200 } },
                { 'matchStats.matchLevel': { $gte: 2 } },
                { 'matchStats.elo': 1000 }
            ]
        };

        const updateDoc = {
            $set: {
                'matchStats.elo': 100,
                'matchStats.matchLevel': 1
                // 'matchStats.totalMatches': 0
            }
        };

        const result = await usersCollection.updateMany(filter, updateDoc);

        console.log(`✅ Update Successful!`);
        console.log(`Matched Documents: ${result.matchedCount}`);
        console.log(`Modified Documents: ${result.modifiedCount}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
        console.log('👋 Connection closed.');
        process.exit(0);
    }
}

fixEloNative();
