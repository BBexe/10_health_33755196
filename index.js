const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');

// Load environment variables
dotenv.config();

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true
}));

// Middleware to make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Routes
const mainRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const scheduleRouter = require('./routes/schedule');

app.use('/', mainRouter);
app.use('/users', usersRouter);
app.use('/schedule', scheduleRouter);

// Start server
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
