const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to check if user is logged in
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    }
    next();
};

// List all workouts for the logged-in user
router.get('/', requireLogin, (req, res) => {
    const sql = 'SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC';
    db.query(sql, [req.session.userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.render('dashboard', { username: req.session.username, error: 'Error fetching workouts' });
        }
        res.render('workouts/index', { 
            title: 'My Workouts', 
            workouts: results, 
            username: req.session.username 
        });
    });
});

// Show form to add a new workout
router.get('/add', requireLogin, (req, res) => {
    res.render('workouts/add', { title: 'Add Workout', username: req.session.username });
});

// Handle adding a new workout
router.post('/add', requireLogin, (req, res) => {
    const { date, type, notes } = req.body;
    
    if (!date || !type) {
        return res.render('workouts/add', { 
            title: 'Add Workout', 
            username: req.session.username,
            error: 'Date and Type are required' 
        });
    }

    const sql = 'INSERT INTO workouts (user_id, date, type, notes) VALUES (?, ?, ?, ?)';
    db.query(sql, [req.session.userId, date, type, notes], (err, result) => {
        if (err) {
            console.error(err);
            return res.render('workouts/add', { 
                title: 'Add Workout', 
                username: req.session.username,
                error: 'Error saving workout' 
            });
        }
        res.redirect('/workouts');
    });
});

module.exports = router;
