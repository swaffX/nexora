/**
 * Authentication Middleware
 */

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized', message: 'Discord ile giriş yapmalısınız.' });
}

function ensureGuest(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.status(403).json({ error: 'Already authenticated' });
}

module.exports = {
    ensureAuthenticated,
    ensureGuest
};
