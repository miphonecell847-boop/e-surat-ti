function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        res.locals.user = req.session.user;
        return next();
    }
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
}

function isGuest(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    return next();
}

module.exports = { isAuthenticated, isGuest };
