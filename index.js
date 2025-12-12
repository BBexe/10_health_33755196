const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./config/db'); // Uses your connection pool

// Load environment variables
dotenv.config();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Store Configuration (Uses existing DB connection)
const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 86400000 // Clear expired sessions every 24h
}, db);



// Global Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware
app.use(session({
    key: 'gym_session_cookie',
    secret: process.env.SESSION_SECRET || 'secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false, // Only create session if user logs in/data is modified
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));


app.use((req, res, next) => {
    res.locals.user = req.session.user;

    // Pass flash message to view
    res.locals.flash = req.session.flash;

    // Clear it from session so it doesn't show again
    delete req.session.flash;

    // Save session to confirm deletion, then continue
    req.session.save(() => {
        next();
    });
});

// Routes
const mainRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const scheduleRouter = require('./routes/schedule');
const routinesRouter = require('./routes/routines');

app.use('/', mainRouter);
app.use('/users', usersRouter);
app.use('/schedule', scheduleRouter);
app.use('/routines', routinesRouter);

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});