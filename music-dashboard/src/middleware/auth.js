// Auth middleware
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/login');
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated()) {
        // Add admin check logic here if needed
        return next();
    }
    res.redirect('/');
}

module.exports = { isAuthenticated, isAdmin };
