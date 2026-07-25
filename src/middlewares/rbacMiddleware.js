function checkRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;
        if (allowedRoles.includes(userRole) || userRole === 'admin') {
            return next();
        }

        return res.status(403).render('error', {
            title: '403 Forbidden',
            message: 'Anda tidak memiliki hak akses untuk membuka halaman ini.',
            user: req.session.user
        });
    };
}

module.exports = checkRole;
