const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');

router.get('/', (req, res) => {
    const sql = `
        SELECT s.id, s.day, s.start_time, s.capacity, a.name, a.description, a.cost 
        FROM Schedule s 
        JOIN Activities a ON s.activity_id = a.id 
        ORDER BY FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), s.start_time
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.render('dashboard', { user: req.session.user, bookings: [], error: 'Error fetching schedule' });
        }
        res.render('schedule', { title: 'Class Schedule', schedule: results, user: req.session.user });
    });
});

// Handle Booking
router.post('/book', redirectLogin, (req, res) => {
    const { schedule_id } = req.body;
    const userId = req.session.user.id;

    // Insert booking
    const sql = 'INSERT INTO Bookings (user_id, schedule_id, booking_date) VALUES (?, ?, CURDATE())';
    db.query(sql, [userId, schedule_id], (err, result) => {
        if (err) {
            console.error(err);
            return res.send('Error booking class');
        }
        res.redirect('/dashboard');
    });
});

module.exports = router;
