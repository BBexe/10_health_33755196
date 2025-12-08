const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');

// Home Page
router.get('/', (req, res) => {
    res.render('index', { title: 'Gym&Gain', user: req.session.user });
});

// Dashboard Route
router.get('/dashboard', redirectLogin, (req, res) => {
    const sql = `
        SELECT b.id, a.name, s.day, s.start_time, b.status 
        FROM Bookings b
        JOIN Schedule s ON b.schedule_id = s.id
        JOIN Activities a ON s.activity_id = a.id
        WHERE b.user_id = ?
        ORDER BY b.booking_date DESC, s.start_time ASC
    `;
    db.query(sql, [req.session.user.id], (err, results) => {
        if (err) {
            console.error(err);
            return res.render('dashboard', { user: req.session.user, bookings: [], error: 'Error fetching bookings' });
        }
        res.render('dashboard', { user: req.session.user, bookings: results });
    });
});

module.exports = router;
