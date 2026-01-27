const router = require('express').Router();
const passport = require('passport');

// Login with Discord
router.get('/login', passport.authenticate('discord'));

// OAuth2 Callback
router.get('/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

// Logout
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/');
    });
});

module.exports = router;
