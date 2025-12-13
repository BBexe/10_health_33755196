const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');

// Helper function to get dates for the upcoming week
function getNextWeekDates() {
    const weekDates = {};
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const today = new Date();
    const currentDay = today.getDay(); 

    dayNames.forEach(day => {
        const targetDay = dayMap[day];
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;

        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntil);
        weekDates[day] = nextDate.toISOString().split('T')[0];
    });

    return weekDates;
}

// Home Page with Schedule
const expressSanitizer = require('express-sanitizer');
router.use(expressSanitizer());
router.get('/', (req, res) => {
    // Prevent caching so the schedule is always fresh (fixes "Back button" stale data)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    req.query.search = req.sanitize(req.query.search);
    const searchQuery = req.query.search;
    const weekDates = getNextWeekDates();
    const dateValues = Object.values(weekDates);

    let query = `
        SELECT s.id, s.day, s.start_time, s.capacity, a.name, a.description, a.cost, a.tier_required 
        FROM schedule s 
        JOIN activities a ON s.activity_id = a.id
    `;

    const params = [];
    if (searchQuery) {
        query += ' WHERE a.name LIKE ?';
        params.push(`%${searchQuery}%`);
    }

    query += ' ORDER BY FIELD(day, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), start_time';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server Error');
        }

        // Fetch booking counts for the displayed week
        const bookingQuery = `
            SELECT schedule_id, booking_date, COUNT(*) as count 
            FROM Bookings 
            WHERE booking_date IN (?) AND status = 'confirmed' 
            GROUP BY schedule_id, booking_date
        `;

        db.query(bookingQuery, [dateValues], (err, bookingCounts) => {
            if (err) {
                console.error('Error fetching booking counts:', err);
                // Continue without counts if error
                return res.render('index', {
                    title: 'Gym&Gain - Home',
                    user: req.session.user,
                    schedule: results,
                    searchQuery: searchQuery,
                    weekDates: weekDates
                });
            }

            // Map counts to schedule items
            results.forEach(item => {
                const itemDate = weekDates[item.day];
                const countRecord = bookingCounts.find(b =>
                    b.schedule_id === item.id &&
                    // Compare dates as strings to avoid timezone issues
                    new Date(b.booking_date).toISOString().split('T')[0] === itemDate
                );
                item.booked_count = countRecord ? countRecord.count : 0;
            });

            console.log('Rendering index with schedule items:', results ? results.length : 'null');

            res.render('index', {
                title: 'Gym&Gain - Home',
                user: req.session.user,
                schedule: results,
                searchQuery: searchQuery,
                weekDates: weekDates
            });
        });
    });
});

// About Page
router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us', user: req.session.user });
});

// Social Page
router.get('/social', redirectLogin, (req, res) => {
    const sql = `
        SELECT u.username, a.name as activity_name, b.booking_date, s.start_time, s.day
        FROM Bookings b
        JOIN Users u ON b.user_id = u.id
        JOIN Schedule s ON b.schedule_id = s.id
        JOIN Activities a ON s.activity_id = a.id
        WHERE b.status = 'confirmed'
        ORDER BY b.booking_date DESC, s.start_time ASC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching social feed:', err);
            return res.render('social', { title: 'Social', user: req.session.user, bookings: [] });
        }
        res.render('social', { title: 'Community Activity', user: req.session.user, bookings: results });
    });
});


// Dashboard Route
router.get('/dashboard', redirectLogin, (req, res) => {
    const userId = req.session.user.id;

    // 1. Fetch latest user details (balance, tier) from DB
    const userSql = "SELECT * FROM Users WHERE id = ?";

    db.query(userSql, [userId], (err, userResults) => {
        if (err || userResults.length === 0) {
            console.error('Error fetching fresh user data:', err);
            // Fallback to session user if DB fails, but log it
            return renderDashboard(req, res, req.session.user);
        }

        const freshUser = userResults[0];

        // Update session with fresh data
        req.session.user = {
            id: freshUser.id,
            username: freshUser.username,
            firstname: freshUser.firstname,
            lastname: freshUser.lastname,
            email: freshUser.email,
            token_balance: freshUser.token_balance,
            membership_type: freshUser.membership_type,
            membership_tier: freshUser.membership_tier
        };

        // Save session (async) but don't block rendering
        req.session.save();

        renderDashboard(req, res, req.session.user);
    });
});

function renderDashboard(req, res, currentUser) {
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
        res.locals.user = currentUser;
        res.render('dashboard', { title: 'Dashboard', user: currentUser, bookings: results });
    });
}

module.exports = router;
