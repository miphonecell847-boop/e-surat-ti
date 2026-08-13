const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const appConfig = require('./config/app');

// Initialize database
require('./config/database');

const app = express();

// Body Parser Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware
app.use(session({
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Express EJS Layouts & View Engine Setup
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

// Static Files
const isVercelEnv = process.env.VERCEL || process.env.NOW_BUILDER;
if (isVercelEnv) {
    const fs = require('fs');
    const tmpUploads = path.join('/tmp', 'uploads');
    if (!fs.existsSync(tmpUploads)) {
        try { fs.mkdirSync(tmpUploads, { recursive: true }); } catch (e) {}
    }
    app.use('/uploads', express.static(tmpUploads));
}
app.use(express.static(path.join(__dirname, 'public')));

// Pass Session User & Current Path to All Views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.originalUrl || req.path || '';
    next();
});

// Routes Mounting
const authRoutes = require('./src/routes/auth');
const webRoutes = require('./src/routes/web');
const apiRoutes = require('./src/routes/api');

// 1. Root Route - Landing Page Utama
app.get('/', (req, res) => {
    return res.render('landing', {
        user: req.session.user || null,
        layout: false
    });
});

// 2. Application Routes Mounting
app.use('/', authRoutes);
app.use('/', webRoutes);
app.use('/api/v1', apiRoutes);



// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 Page Not Found',
        message: 'Halaman yang Anda cari tidak ditemukan.'
    });
});

// Start Server (Standalone / Local execution)
if (require.main === module) {
    app.listen(appConfig.port, () => {
        console.log(`=======================================================`);
        console.log(`🚀 E-Surat Administrasi TA berjalan di ${appConfig.baseUrl}`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
