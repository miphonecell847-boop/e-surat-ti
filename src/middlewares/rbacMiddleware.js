function checkRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        let userRole = req.session.user.role;
        if (userRole === 'staff_tu' || userRole === 'stafftu' || userRole === 'sekretaris_prodi' || userRole === 'sekprodi' || userRole === 'kaprodi' || userRole === 'admin') {
            userRole = 'admin';
        }

        const normalizedAllowed = new Set(allowedRoles);

        if (normalizedAllowed.has('admin') || normalizedAllowed.has('staff_tu') || normalizedAllowed.has('stafftu') || normalizedAllowed.has('tu') || normalizedAllowed.has('sekprodi') || normalizedAllowed.has('kaprodi')) {
            normalizedAllowed.add('admin');
            normalizedAllowed.add('staff_tu');
            normalizedAllowed.add('stafftu');
            normalizedAllowed.add('tu');
            normalizedAllowed.add('sekprodi');
            normalizedAllowed.add('kaprodi');
        }
        if (normalizedAllowed.has('mahasiswa') || normalizedAllowed.has('mhs')) {
            normalizedAllowed.add('mahasiswa');
            normalizedAllowed.add('mhs');
        }

        if (normalizedAllowed.has(userRole)) {
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
