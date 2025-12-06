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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true
}));

// Routes
const usersRouter = require('./routes/users');
const workoutsRouter = require('./routes/workouts');

app.use('/users', usersRouter);
app.use('/workouts', workoutsRouter);

// Basic Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Gym&Gain', user: req.session.username });
});

// Dashboard Route
app.get('/dashboard', (req, res) => {
    if (req.session.userId) {
        res.render('dashboard', { username: req.session.username });
    } else {
        res.redirect('/users/login');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
