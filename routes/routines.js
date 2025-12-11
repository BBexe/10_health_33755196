const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// GET /routines - Redirect to JSON 
router.get('/', isAuthenticated, (req, res) => {
    res.redirect('/routines/json');
});

// GET /routines/new - Form to create new routine
router.get('/new', isAuthenticated, (req, res) => {
    res.render('routines/new', { 
        user: req.session.user 
    });
});

// POST /routines - Save new routine 
router.post('/', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { routine_name, description } = req.body;
    
    const query = 'INSERT INTO Routines (user_id, routine_name, description) VALUES (?, ?, ?)';
    db.query(query, [userId, routine_name, description], (err, result) => {
        if (err) {
            console.error('Error creating routine:', err);
            return res.status(500).send('Error creating routine');
        }
        
        res.redirect('/routines/json');
    });
});

// GET /routines/json - View all routines as JSON
router.get('/json', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    
    const query = 'SELECT * FROM Routines WHERE user_id = ? ORDER BY created_at DESC';
    db.query(query, [userId], (err, routines) => {
        if (err) {
            console.error('Error fetching routines:', err);
            return res.status(500).json({ error: 'Error loading routines' });
        }
        
        res.json({
            success: true,
            count: routines.length,
            routines: routines
        });
    });
});

module.exports = router;
