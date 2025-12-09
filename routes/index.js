const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');
const log = require('../debug_logger');

// Home Page
router.get('/', (req, res) => {
    res.render('index', { title: 'Gym&Gain', user: req.session.user });
});

// About Page
router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us', user: req.session.user });
});

// Social Page
router.get('/social', redirectLogin, (req, res) => {
    res.render('social', { title: 'Social', user: req.session.user });
});


// Dashboard Route
router.get('/dashboard', redirectLogin, (req, res) => {
    const currentUser = req.session.user;
    
    const sql = `
        SELECT b.id, a.name, s.day, s.start_time, b.status 
        FROM Bookings b
        JOIN Schedule s ON b.schedule_id = s.id
        JOIN Activities a ON s.activity_id = a.id
        WHERE b.user_id = ?
        ORDER BY b.booking_date DESC, s.start_time ASC
    `;
    
    db.query(sql, [currentUser.id], (err, results) => {
        if (err) {
            console.error('Dashboard DB Error:', err);
            return res.render('dashboard', { title: 'Dashboard', user: currentUser, bookings: [], error: 'Error fetching bookings' });
        }
        // Explicitly set res.locals.user to ensure it's available to all views/partials
        res.locals.user = currentUser;
        res.render('dashboard', { title: 'Dashboard', user: currentUser, bookings: results });
    });
});

module.exports = router;
