function checkRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        let userRole = req.session.user.role;
        if (userRole === 'sekretaris_prodi' || userRole === 'sekprodi' || userRole === 'kaprodi' || userRole === 'admin') {
            userRole = 'staff_tu';
        }

        const normalizedAllowed = new Set(allowedRoles);

        if (normalizedAllowed.has('staff_tu') || normalizedAllowed.has('stafftu') || normalizedAllowed.has('tu')) {
            normalizedAllowed.add('staff_tu');
            normalizedAllowed.add('stafftu');
            normalizedAllowed.add('tu');
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
