function checkRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;
        const normalizedAllowed = new Set(allowedRoles);

        // Role Aliases
        if (normalizedAllowed.has('sekretaris_prodi') || normalizedAllowed.has('sekprodi')) {
            normalizedAllowed.add('sekretaris_prodi');
            normalizedAllowed.add('sekprodi');
        }
        if (normalizedAllowed.has('staff_tu') || normalizedAllowed.has('stafftu') || normalizedAllowed.has('tu')) {
            normalizedAllowed.add('staff_tu');
            normalizedAllowed.add('stafftu');
            normalizedAllowed.add('tu');
            normalizedAllowed.add('admin');
        }
        if (normalizedAllowed.has('mahasiswa') || normalizedAllowed.has('mhs')) {
            normalizedAllowed.add('mahasiswa');
            normalizedAllowed.add('mhs');
        }

        if (normalizedAllowed.has(userRole) || (userRole === 'admin' && normalizedAllowed.has('staff_tu'))) {
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
