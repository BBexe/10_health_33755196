// Import required modules
const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv'); // For environment variables
const session = require('express-session'); // Session middleware
const MySQLStore = require('express-mysql-session')(session); // MySQL session store
const db = require('./config/db'); // Database connection pool

// Load environment variables
dotenv.config();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Store Configuration
const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 86400000 // Clear expired sessions every 24 hours
}, db);



// Global Middleware
// Log every request to the console
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));
// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// Express-sanitizer middleware (must be after body parsers)
const expressSanitizer = require('express-sanitizer');
app.use(expressSanitizer());

// Session Middleware
// Configure session handling with MySQL store
app.use(session({
    key: 'gym_session_cookie', // Name of the session cookie
    secret: process.env.SESSION_SECRET, // Secret for signing the session ID
    store: sessionStore, // Use MySQL for session storage
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Only create session if user logs in/data is modified
    httpOnly: true, // Prevent client-side JS from accessing the cookie
    secure: false, // Ensure cookie is only sent over HTTPS (False for Intranet HTTP)
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day in milliseconds
    }
}));


// Middleware for Base Path Helpers (Must run before routes)
app.use((req, res, next) => {
    const basePath = process.env.HEALTH_BASE_PATH || '';

    // Helper for Views: Generates absolute URL with base path
    res.locals.url = (path) => {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return basePath + cleanPath;
    };

    // Helper for Controllers: Redirects relative to base path
    res.redirectBase = (path) => {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        res.redirect(basePath + cleanPath);
    };

    res.locals.baseUrl = basePath; // Component compatibility
    next();
});

// Middleware for User Session and Flash Messages
app.use((req, res, next) => {
    res.locals.user = req.session.user; // Current logged-in user

    // Pass flash message to view
    res.locals.flash = req.session.flash;

    // Clear flash message after displaying it
    delete req.session.flash;

    // Save session to confirm deletion, then continue
    req.session.save(() => {
        next();
    });
});




// Import route handlers
const mainRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const scheduleRouter = require('./routes/schedule');
const routinesRouter = require('./routes/routines');

// Register routes
app.use('/', mainRouter); // Main routes
app.use('/users', usersRouter); // User-related routes
app.use('/schedule', scheduleRouter); // Schedule-related routes
app.use('/routines', routinesRouter); // Routines-related routes

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});