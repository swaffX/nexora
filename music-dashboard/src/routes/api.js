const router = require('express').Router();
const { isAuthenticated } = require('../middleware/auth');
const path = require('path');

const MusicUser = require(path.join(__dirname, '..', '..', '..', 'shared', 'models', 'MusicUser'));
const MusicGuild = require(path.join(__dirname, '..', '..', '..', 'shared', 'models', 'MusicGuild'));

router.use(isAuthenticated);

// Delete playlist
router.delete('/playlists/:id', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);
        musicUser.playlists.id(req.params.id).deleteOne();
        await musicUser.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Delete playlist error:', err);
        res.status(500).json({ error: 'Playlist silinemedi' });
    }
});

// Rename playlist
router.patch('/playlists/:id', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.length > 32) {
            return res.status(400).json({ error: 'Geçersiz isim' });
        }

        const musicUser = await MusicUser.getOrCreate(req.user.id);
        const playlist = musicUser.playlists.id(req.params.id);

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist bulunamadı' });
        }

        playlist.name = name;
        await musicUser.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Rename playlist error:', err);
        res.status(500).json({ error: 'Playlist yeniden adlandırılamadı' });
    }
});

// Remove track from playlist
router.delete('/playlists/:id/tracks/:index', async (req, res) => {
    try {
        const musicUser = await MusicUser.getOrCreate(req.user.id);
        const playlist = musicUser.playlists.id(req.params.id);

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist bulunamadı' });
        }

        const index = parseInt(req.params.index);
        if (index < 0 || index >= playlist.tracks.length) {
            return res.status(400).json({ error: 'Geçersiz şarkı indexi' });
        }

        playlist.tracks.splice(index, 1);
        await musicUser.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Remove track error:', err);
        res.status(500).json({ error: 'Şarkı kaldırılamadı' });
    }
});

// Update server settings
router.post('/servers/:id/settings', async (req, res) => {
    try {
        const guildId = req.params.id;
        const { djRoleId, defaultVolume, announceNowPlaying, autoLeaveMinutes, language } = req.body;

        // Verify user has permission (MANAGE_GUILD)
        const userGuilds = req.user.guilds || [];
        const guild = userGuilds.find(g => g.id === guildId);
        if (!guild || (parseInt(guild.permissions) & 0x20) !== 0x20) {
            return res.status(403).json({ error: 'Yetkiniz yok' });
        }

        const guildSettings = await MusicGuild.getOrCreate(guildId);

        if (djRoleId !== undefined) guildSettings.djRoleId = djRoleId || null;
        if (defaultVolume !== undefined) guildSettings.defaultVolume = Math.max(1, Math.min(100, parseInt(defaultVolume)));
        if (announceNowPlaying !== undefined) guildSettings.announceNowPlaying = announceNowPlaying === true || announceNowPlaying === 'true';
        if (autoLeaveMinutes !== undefined) guildSettings.autoLeaveMinutes = Math.max(1, Math.min(30, parseInt(autoLeaveMinutes)));
        if (language !== undefined) guildSettings.language = ['tr', 'en'].includes(language) ? language : 'tr';

        await guildSettings.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Ayarlar güncellenemedi' });
    }
});

module.exports = router;
