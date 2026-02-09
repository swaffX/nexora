const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const TrainerSettings = require('../models/TrainerSettings');

// Get User Settings
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const settings = await TrainerSettings.findOrCreate(req.user.id);
        res.json(settings);
    } catch (error) {
        console.error('Settings fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update User Settings
router.put('/', ensureAuthenticated, async (req, res) => {
    try {
        const settings = await TrainerSettings.findOrCreate(req.user.id);
        
        // Update fields
        if (req.body.sensitivity !== undefined) settings.sensitivity = req.body.sensitivity;
        if (req.body.dpi !== undefined) settings.dpi = req.body.dpi;
        if (req.body.crosshair) Object.assign(settings.crosshair, req.body.crosshair);
        if (req.body.graphics) Object.assign(settings.graphics, req.body.graphics);
        if (req.body.audio) Object.assign(settings.audio, req.body.audio);
        
        await settings.save();
        
        res.json({
            success: true,
            settings
        });
        
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Import Valorant Settings (Paste from clipboard)
router.post('/import-valorant', ensureAuthenticated, async (req, res) => {
    try {
        const { valorantSettings } = req.body;
        
        // Parse Valorant settings string (örnek format)
        // "0;s;1;P;c;5;o;1;d;1;z;3;0t;1;0l;2;0o;2;0a;1;0f;0;1b;0"
        
        const settings = await TrainerSettings.findOrCreate(req.user.id);
        
        // Basit parsing (gerçek Valorant formatına göre ayarlanmalı)
        if (valorantSettings.sensitivity) settings.sensitivity = valorantSettings.sensitivity;
        if (valorantSettings.crosshair) {
            Object.assign(settings.crosshair, valorantSettings.crosshair);
        }
        
        await settings.save();
        
        res.json({
            success: true,
            message: 'Valorant ayarları başarıyla içe aktarıldı',
            settings
        });
        
    } catch (error) {
        console.error('Valorant import error:', error);
        res.status(500).json({ error: 'Failed to import Valorant settings' });
    }
});

module.exports = router;
