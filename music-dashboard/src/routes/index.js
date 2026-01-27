const router = require('express').Router();

// Landing Page
router.get('/', async (req, res) => {
    // Get stats
    let stats = { servers: 0, users: 0, playlists: 0 };

    try {
        const MusicUser = require('../../../shared/models/MusicUser');
        const MusicGuild = require('../../../shared/models/MusicGuild');

        stats.users = await MusicUser.countDocuments();
        stats.servers = await MusicGuild.countDocuments();

        // Count total playlists
        const usersWithPlaylists = await MusicUser.find({ 'playlists.0': { $exists: true } });
        stats.playlists = usersWithPlaylists.reduce((acc, u) => acc + u.playlists.length, 0);
    } catch (e) {
        console.error('Stats error:', e);
    }

    res.render('index', {
        title: 'Neurovia Music - Discord Müzik Botu',
        stats
    });
});

// Features page
router.get('/features', (req, res) => {
    res.render('features', {
        title: 'Özellikler - Neurovia Music'
    });
});

// Commands page
router.get('/commands', (req, res) => {
    res.render('commands', {
        title: 'Komutlar - Neurovia Music'
    });
});

module.exports = router;
