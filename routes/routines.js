const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');

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

// POST /routines - Save new routine with optional exercise
router.post('/', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { routine_name, description, exercise_name, exercise_sets, exercise_reps } = req.body;
    
    db.getConnection((err, connection) => {
        if (err) {
            console.error('Connection error:', err);
            return res.status(500).send('Database connection error');
        }
        
        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                console.error('Transaction error:', err);
                return res.status(500).send('Transaction error');
            }
            
            // Insert routine
            const routineQuery = 'INSERT INTO Routines (user_id, routine_name, description) VALUES (?, ?, ?)';
            connection.query(routineQuery, [userId, routine_name, description], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error('Error creating routine:', err);
                        res.status(500).send('Error creating routine');
                    });
                }
                
                const routineId = result.insertId;
                
                // Insert exercise if provided
                if (exercise_name && exercise_name.trim() !== '') {
                    const exerciseQuery = `
                        INSERT INTO Routine_Exercises 
                        (routine_id, exercise_id, exercise_name, sets, reps, order_index) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    
                    connection.query(exerciseQuery, [
                        routineId,
                        0, // exercise_id placeholder (no API integration yet)
                        exercise_name.trim(),
                        exercise_sets || 3,
                        exercise_reps || 10,
                        0 // first exercise, index 0
                    ], (err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Error adding exercise:', err);
                                res.status(500).send('Error adding exercise');
                            });
                        }
                        
                        connection.commit((err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('Commit error:', err);
                                    res.status(500).send('Error saving routine');
                                });
                            }
                            
                            connection.release();
                            res.redirect('/routines/json');
                        });
                    });
                } else {
                    // No exercise, just commit the routine
                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Commit error:', err);
                                res.status(500).send('Error saving routine');
                            });
                        }
                        
                        connection.release();
                        res.redirect('/routines/json');
                    });
                }
            });
        });
    });
});

// GET /routines/json - View all routines with exercises as JSON
router.get('/json', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    
    // Get all routines for user
    const routinesQuery = 'SELECT * FROM Routines WHERE user_id = ? ORDER BY created_at DESC';
    db.query(routinesQuery, [userId], (err, routines) => {
        if (err) {
            console.error('Error fetching routines:', err);
            return res.status(500).json({ error: 'Error loading routines' });
        }
        
        if (routines.length === 0) {
            return res.json({
                success: true,
                count: 0,
                routines: []
            });
        }
        
        // Get exercises for all routines
        const routineIds = routines.map(r => r.routine_id);
        const exercisesQuery = `
            SELECT * FROM Routine_Exercises 
            WHERE routine_id IN (?) 
            ORDER BY routine_id, order_index
        `;
        
        db.query(exercisesQuery, [routineIds], (err, exercises) => {
            if (err) {
                console.error('Error fetching exercises:', err);
                return res.status(500).json({ error: 'Error loading exercises' });
            }
            
            // Attach exercises to each routine
            routines.forEach(routine => {
                routine.exercises = exercises.filter(ex => ex.routine_id === routine.routine_id);
            });
            
            res.json({
                success: true,
                count: routines.length,
                routines: routines
            });
        });
    });
});

// GET /routines/test-api - Test Wger API search
router.get('/test-api', isAuthenticated, async (req, res) => {
    const searchTerm = req.query.q || 'bench';
    
    try {
        console.log('Testing Wger API with search term:', searchTerm);
        
        const response = await axios.get('https://wger.de/api/v2/exercise/search/', {
            params: {
                term: searchTerm,
                language: 2
            },
            headers: {
                'Accept': 'application/json'
            }
        });
        
        res.json({
            success: true,
            search_term: searchTerm,
            api_url: 'https://wger.de/api/v2/exercise/search/',
            result_count: response.data.suggestions ? response.data.suggestions.length : 0,
            raw_response: response.data
        });
        
    } catch (error) {
        console.error('Error fetching from Wger API:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message,
            search_term: searchTerm
        });
    }
});

module.exports = router;
