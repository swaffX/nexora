const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const TrainerScore = require('../models/TrainerScore');
const TrainerSettings = require('../models/TrainerSettings');

// Submit Score (Authenticated)
router.post('/submit', ensureAuthenticated, async (req, res) => {
    try {
        const { mapId, score, accuracy, hits, misses, duration, settings } = req.body;
        
        // Validation
        if (!mapId || score === undefined || !duration) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const validMaps = ['gridshot', 'tracking', 'flicking', 'microshot', 'sixshot', 'spidershot'];
        if (!validMaps.includes(mapId)) {
            return res.status(400).json({ error: 'Invalid map ID' });
        }
        
        // Create Score Entry
        const newScore = await TrainerScore.create({
            userId: req.user.id,
            username: req.user.username,
            avatar: req.user.avatar,
            mapId,
            score,
            accuracy: accuracy || 0,
            hits: hits || 0,
            misses: misses || 0,
            duration,
            settings: settings || {},
            deviceInfo: {
                userAgent: req.headers['user-agent'],
                screenResolution: req.body.screenResolution
            }
        });
        
        // Update User Stats
        const userSettings = await TrainerSettings.findOrCreate(req.user.id);
        userSettings.stats.totalGamesPlayed += 1;
        userSettings.stats.totalTimeSpent += duration;
        await userSettings.save();
        
        // Get User Rank
        const rank = await TrainerScore.getUserRank(req.user.id, mapId);
        const bestScore = await TrainerScore.getUserBestScore(req.user.id, mapId);
        
        res.json({
            success: true,
            score: newScore,
            rank,
            personalBest: bestScore?.score || score,
            isNewBest: !bestScore || score > bestScore.score
        });
        
    } catch (error) {
        console.error('Score submission error:', error);
        res.status(500).json({ error: 'Failed to submit score' });
    }
});

// Get Leaderboard
router.get('/leaderboard/:mapId', async (req, res) => {
    try {
        const { mapId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        const leaderboard = await TrainerScore.getLeaderboard(mapId, limit);
        
        res.json({
            mapId,
            leaderboard
        });
        
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Get User Stats
router.get('/user/:userId/:mapId', async (req, res) => {
    try {
        const { userId, mapId } = req.params;
        
        const bestScore = await TrainerScore.getUserBestScore(userId, mapId);
        const rank = await TrainerScore.getUserRank(userId, mapId);
        const recentScores = await TrainerScore.find({ userId, mapId })
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.json({
            bestScore,
            rank,
            recentScores
        });
        
    } catch (error) {
        console.error('User stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

// Get User's Personal Best for All Maps
router.get('/user/:userId/all', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const maps = ['gridshot', 'tracking', 'flicking', 'microshot', 'sixshot', 'spidershot'];
        const results = {};
        
        for (const mapId of maps) {
            const bestScore = await TrainerScore.getUserBestScore(userId, mapId);
            const rank = await TrainerScore.getUserRank(userId, mapId);
            results[mapId] = {
                bestScore: bestScore?.score || 0,
                accuracy: bestScore?.accuracy || 0,
                rank: rank || null
            };
        }
        
        res.json(results);
        
    } catch (error) {
        console.error('User all stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

module.exports = router;
