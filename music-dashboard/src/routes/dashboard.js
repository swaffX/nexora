const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const path = require('path');

const MusicUser = require(path.join(__dirname, '..', '..', '..', 'shared', 'models', 'MusicUser'));
const MusicGuild = require(path.join(__dirname, '..', '..', '..', 'shared', 'models', 'MusicGuild'));

// Apply auth middleware to all dashboard routes
router.use(isAuthenticated);

// Main Dashboard
router.get('/', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);

        // Filter guilds where bot is present (we'll check this via settings)
        const userGuilds = req.user.guilds || [];
        const botGuilds = await MusicGuild.find({});
        const botGuildIds = botGuilds.map(g => g.guildId);

        // User's guilds where they have MANAGE_GUILD permission and bot is present
        const manageableGuilds = userGuilds.filter(g =>
            (parseInt(g.permissions) & 0x20) === 0x20 && botGuildIds.includes(g.id)
        );

        res.render('dashboard', {
            title: 'Dashboard - Neurovia Music',
            musicUser,
            guilds: manageableGuilds,
            activeTab: 'overview'
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.redirect('/');
    }
});

// Playlists Page
router.get('/playlists', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);

        res.render('playlists', {
            title: 'Playlistler - Neurovia Music',
            musicUser,
            playlists: musicUser.playlists,
            activeTab: 'playlists'
        });
    } catch (err) {
        console.error('Playlists error:', err);
        res.redirect('/dashboard');
    }
});

// Single Playlist View
router.get('/playlists/:id', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);
        const playlist = musicUser.playlists.id(req.params.id);

        if (!playlist) {
            return res.redirect('/dashboard/playlists');
        }

        res.render('playlist-detail', {
            title: `${playlist.name} - Neurovia Music`,
            musicUser,
            playlist,
            activeTab: 'playlists'
        });
    } catch (err) {
        console.error('Playlist detail error:', err);
        res.redirect('/dashboard/playlists');
    }
});

// Server Settings Page
router.get('/servers/:id', async (req, res) => {
    try {
        const guildId = req.params.id;
        const userGuilds = req.user.guilds || [];

        // Check if user has permission for this guild
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild || (parseInt(guild.permissions) & 0x20) !== 0x20) {
            return res.redirect('/dashboard');
        }

        const guildSettings = await MusicGuild.getOrCreate(guildId);

        res.render('settings', {
            title: `${guild.name} Ayarları - Neurovia Music`,
            guild,
            settings: guildSettings,
            activeTab: 'servers'
        });
    } catch (err) {
        console.error('Settings error:', err);
        res.redirect('/dashboard');
    }
});

// Profile Page
router.get('/profile', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);

        res.render('profile', {
            title: 'Profil - Neurovia Music',
            musicUser,
            activeTab: 'profile'
        });
    } catch (err) {
        console.error('Profile error:', err);
        res.redirect('/dashboard');
    }
});

module.exports = router;
