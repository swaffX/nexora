/**
 * Fix Match Status Script
 * 
 * Problem: finishMatch fonksiyonunda match.status = 'FINISHED' set edilmiyordu.
 * Bu yüzden ELO hesaplandı ama /stats komutu bu maçları bulamadı.
 * 
 * Bu script, winner alanı dolu olan ama status FINISHED olmayan tüm maçları düzeltir.
 */

const mongoose = require('mongoose');
const path = require('path');

// .env yükleme
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.MONGODB_URI) {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

console.log('MongoDB URI Status:', process.env.MONGODB_URI ? 'Loaded' : '⚠️ NOT FOUND');

// Manuel schema (bağımsız çalışabilsin)
const matchSchema = new mongoose.Schema({
    matchId: String,
    matchNumber: Number,
    status: String,
    winner: String,
    eloChanges: Array,
    scoreA: Number,
    scoreB: Number
}, { collection: 'matches', strict: false });

const MatchModel = mongoose.models.Match || mongoose.model('Match', matchSchema);

async function fixMatchStatuses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected to DB.');

        // 1. Spesifik olarak bildirilen 2 maçı kontrol et
        const reportedMatchIds = ['1470558833406377985', '1470549504246808760'];

        console.log('\n--- Bildirilen Maçlar ---');
        for (const mid of reportedMatchIds) {
            const m = await MatchModel.findOne({ matchId: mid });
            if (m) {
                console.log(`Match ${mid}: status="${m.status}", winner="${m.winner}", score=${m.scoreA}-${m.scoreB}`);
            } else {
                console.log(`Match ${mid}: ❌ BULUNAMADI`);
            }
        }

        // 2. Winner alanı dolu olup status FINISHED olmayan TÜM maçları bul
        const brokenMatches = await MatchModel.find({
            winner: { $in: ['A', 'B'] },
            status: { $ne: 'FINISHED' }
        });

        console.log(`\n--- Düzeltilecek Maçlar ---`);
        console.log(`Toplam ${brokenMatches.length} maç bulundu (winner var ama status != FINISHED):`);

        for (const m of brokenMatches) {
            console.log(`  Match #${m.matchNumber || '?'} (${m.matchId}): status="${m.status}" → "FINISHED" | winner=${m.winner} | score=${m.scoreA}-${m.scoreB}`);
        }

        if (brokenMatches.length === 0) {
            console.log('Düzeltilecek maç yok. Her şey doğru.');
        } else {
            // 3. Toplu güncelleme
            const result = await MatchModel.updateMany(
                { winner: { $in: ['A', 'B'] }, status: { $ne: 'FINISHED' } },
                { $set: { status: 'FINISHED' } }
            );
            console.log(`\n✅ ${result.modifiedCount} maç "FINISHED" olarak güncellendi.`);
        }

        // 4. Doğrulama
        console.log('\n--- Doğrulama ---');
        for (const mid of reportedMatchIds) {
            const m = await MatchModel.findOne({ matchId: mid });
            if (m) {
                console.log(`Match ${mid}: status="${m.status}" ✅`);
            }
        }

    } catch (e) {
        console.error('SCRIPT ERROR:', e);
    } finally {
        console.log('\nClosing connection...');
        await mongoose.disconnect();
        console.log('Done.');
    }
}

fixMatchStatuses();
