const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');
const redirectLogin = require('../middleware/auth');
const expressSanitizer = require('express-sanitizer');

// Add sanitizer middleware for all routes in this router
router.use(expressSanitizer());

// GET /routines - View all routines
router.get('/', redirectLogin, (req, res) => {
    const userId = req.session.user.id;
    
    const routinesQuery = 'SELECT * FROM Routines WHERE user_id = ? ORDER BY created_at DESC';
    db.query(routinesQuery, [userId], (err, routines) => {
        if (err) {
            console.error('Error fetching routines:', err);
            return res.status(500).send('Error loading routines');
        }
        
        if (routines.length === 0) {
            return res.render('routines', { 
                user: req.session.user,
                routines: []
            });
        }
        
        const routineIds = routines.map(r => r.routine_id);
        const exercisesQuery = 'SELECT * FROM Routine_Exercises WHERE routine_id IN (?) ORDER BY routine_id, order_index';
        
        db.query(exercisesQuery, [routineIds], (err, exercises) => {
            if (err) {
                console.error('Error fetching exercises:', err);
                return res.status(500).send('Error loading exercises');
            }
            
            routines.forEach(routine => {
                routine.exercises = exercises.filter(ex => ex.routine_id === routine.routine_id);
            });
            
            res.render('routines', { 
                user: req.session.user,
                routines: routines
            });
        });
    });
});

// GET /routines/new - Create routine form
router.get('/new', redirectLogin, (req, res) => {
    if (!req.session.tempRoutine) {
        req.session.tempRoutine = { exercises: [] };
    }
    
    res.render('create', { 
        user: req.session.user,
        tempRoutine: req.session.tempRoutine,
        searchResults: null
    });
});

// POST /routines/search - Search exercises
router.post('/search', redirectLogin, async (req, res) => {
    req.body.query = req.sanitize(req.body.query);
    let query = req.body.query || '';
    query = query.trim();
    if (query.length < 2) {
        return res.redirect('/routines/new');
    }
    try {
        const response = await axios.get('https://wger.de/api/v2/exercise/search/', {
            params: { term: query, language: 2 }
        });
        const searchResults = response.data.suggestions || [];
        res.render('create', {
            user: req.session.user,
            tempRoutine: req.session.tempRoutine,
            searchResults: searchResults
        });
    } catch (err) {
        console.error('Search error:', err);
        res.redirect('/routines/new');
    }
});

// POST /routines/add-exercise - Add exercise to temp routine
router.post('/add-exercise', redirectLogin, (req, res) => {
    req.body.exercise_id = req.sanitize(req.body.exercise_id);
    req.body.exercise_name = req.sanitize(req.body.exercise_name);
    req.body.sets = req.sanitize(req.body.sets);
    req.body.reps = req.sanitize(req.body.reps);
    const { exercise_id, exercise_name, sets, reps } = req.body;
    if (!req.session.tempRoutine) {
        req.session.tempRoutine = { exercises: [] };
    }
    if (exercise_name) {
        req.session.tempRoutine.exercises.push({
            exercise_id: exercise_id || 0,
            exercise_name: exercise_name,
            sets: sets || 3,
            reps: reps || 10
        });
    }
    req.session.save(() => {
        res.redirect('/routines/new');
    });
});

// POST /routines/remove-exercise - Remove exercise from temp
router.post('/remove-exercise', redirectLogin, (req, res) => {
    req.body.index = req.sanitize(req.body.index);
    const index = parseInt(req.body.index);
    if (req.session.tempRoutine && req.session.tempRoutine.exercises) {
        req.session.tempRoutine.exercises.splice(index, 1);
    }
    req.session.save(() => {
        res.redirect('/routines/new');
    });
});

// POST /routines - Save routine
router.post('/', redirectLogin, (req, res) => {
    req.body.routine_name = req.sanitize(req.body.routine_name);
    req.body.description = req.sanitize(req.body.description);
    const userId = req.session.user.id;
    const { routine_name, description } = req.body;
    const exercises = req.session.tempRoutine?.exercises || [];
    db.getConnection((err, connection) => {
        if (err) {
            console.error('Connection error:', err);
            return res.status(500).send('Database connection error');
        }
        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).send('Transaction error');
            }
            const routineQuery = 'INSERT INTO Routines (user_id, routine_name, description) VALUES (?, ?, ?)';
            connection.query(routineQuery, [userId, routine_name, description], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).send('Error creating routine');
                    });
                }
                const routineId = result.insertId;
                if (exercises.length === 0) {
                    return connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error saving routine');
                            });
                        }
                        connection.release();
                        delete req.session.tempRoutine;
                        req.session.save(() => res.redirect('/routines'));
                    });
                }
                const exerciseValues = exercises.map((ex, index) => [
                    routineId,
                    ex.exercise_id || 0,
                    ex.exercise_name,
                    ex.sets || 3,
                    ex.reps || 10,
                    index
                ]);
                const exerciseQuery = 'INSERT INTO Routine_Exercises (routine_id, exercise_id, exercise_name, sets, reps, order_index) VALUES ?';
                connection.query(exerciseQuery, [exerciseValues], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).send('Error adding exercises');
                        });
                    }
                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error saving routine');
                            });
                        }
                        connection.release();
                        delete req.session.tempRoutine;
                        req.session.save(() => res.redirect('/routines'));
                    });
                });
            });
        });
    });
});

// GET /routines/json - View all routines with exercises as JSON
router.get('/json', redirectLogin, (req, res) => {
    const userId = req.session.user.id;
    
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
        
        const routineIds = routines.map(r => r.routine_id);
        const exercisesQuery = 'SELECT * FROM Routine_Exercises WHERE routine_id IN (?) ORDER BY routine_id, order_index';
        
        db.query(exercisesQuery, [routineIds], (err, exercises) => {
            if (err) {
                console.error('Error fetching exercises:', err);
                return res.status(500).json({ error: 'Error loading exercises' });
            }
            
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

module.exports = router;
