const express = require('express');
const passport = require('passport');
const router = express.Router();

// Discord OAuth2 Login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth2 Callback
router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: process.env.CLIENT_URL }),
    (req, res) => {
        // Başarılı giriş
        res.redirect(process.env.CLIENT_URL + '/dashboard');
    }
);

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get Current User
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar,
            avatarURL: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
