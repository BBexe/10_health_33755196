// Import required modules
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
    // Ensure trailing slash for relative form actions to work
    if (req.originalUrl && !req.originalUrl.split('?')[0].endsWith('/')) {
        return res.redirectBase('/routines/');
    }
    const userId = req.session.user.id;

    // Query all routines for the user
    const routinesQuery = 'SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC';
    db.query(routinesQuery, [userId], (err, routines) => {
        if (err) {
            console.error('Error fetching routines:', err);
            return res.status(500).send('Error loading routines');
        }

        if (routines.length === 0) {
            // No routines found, render empty list
            return res.render('routines', {
                user: req.session.user,
                routines: []
            });
        }

        // Get all exercises for the found routines
        const routineIds = routines.map(r => r.routine_id);
        const exercisesQuery = 'SELECT * FROM routine_exercises WHERE routine_id IN (?) ORDER BY routine_id, order_index';

        db.query(exercisesQuery, [routineIds], (err, exercises) => {
            if (err) {
                console.error('Error fetching exercises:', err);
                return res.status(500).send('Error loading exercises');
            }

            // Attach exercises to their respective routines
            routines.forEach(routine => {
                routine.exercises = exercises.filter(ex => ex.routine_id === routine.routine_id);
            });

            // Render routines page with routines and exercises
            res.render('routines', {
                user: req.session.user,
                routines: routines
            });
        });
    });
});

// GET /routines/cancel-creation - Clear temp routine and redirect
router.get('/cancel-creation', redirectLogin, (req, res) => {
    if (req.session.tempRoutine) {
        delete req.session.tempRoutine;
    }
    req.session.save(() => {
        res.redirectBase('/routines');
    });
});

// GET /routines/new - Create routine form
router.get('/new', redirectLogin, async (req, res) => {
    try {
        if (!req.session.tempRoutine) {
            req.session.tempRoutine = { exercises: [] };
        }

        const searchQuery = req.query.query;
        let searchResults = [];

        if (searchQuery) {
            try {
                const response = await axios.get('https://wger.de/api/v2/exercise/search/', {
                    params: { term: searchQuery, language: 2 }
                });
                searchResults = response.data.suggestions || [];
            } catch (apiErr) {
                console.error('WGER API Error:', apiErr);
            }
        }

        res.render('create', {
            user: req.session.user,
            tempRoutine: req.session.tempRoutine,
            searchResults: searchResults,
            currentQuery: searchQuery || ''
        });
    } catch (err) {
        console.error('Error rendering create page:', err);
        res.status(500).send('Error loading page');
    }
});

// POST /routines/search - Search exercises
router.post('/search', redirectLogin, (req, res) => {
    req.body.routine_name = req.sanitize(req.body.routine_name);
    req.body.description = req.sanitize(req.body.description);

    // Save routine name and description to session
    if (!req.session.tempRoutine) {
        req.session.tempRoutine = { exercises: [] };
    }
    req.session.tempRoutine.routine_name = req.body.routine_name || '';
    req.session.tempRoutine.description = req.body.description || '';

    const query = req.sanitize(req.body.query);
    // Redirect to GET with query param to persist search state
    res.redirectBase(`/routines/new?query=${encodeURIComponent(query)}`);
});

// POST /routines/add-exercise - Add exercise to temp routine
router.post('/add-exercise', redirectLogin, (req, res) => {
    req.body.exercise_id = req.sanitize(req.body.exercise_id);
    req.body.exercise_name = req.sanitize(req.body.exercise_name);
    req.body.sets = req.sanitize(req.body.sets);
    req.body.reps = req.sanitize(req.body.reps);
    req.body.query = req.sanitize(req.body.query); // Get query to persist it

    const { exercise_id, exercise_name, sets, reps, query } = req.body;
    if (!req.session.tempRoutine) {
        req.session.tempRoutine = { exercises: [] };
    }
    if (exercise_name) {
        // Add exercise to tempRoutine array
        req.session.tempRoutine.exercises.push({
            exercise_id: exercise_id || 0,
            exercise_name: exercise_name,
            sets: sets || 3,
            reps: reps || 10
        });
    }
    req.session.save(() => {
        const redirectUrl = query ? `/routines/new?query=${encodeURIComponent(query)}` : '/routines/new';
        res.redirectBase(redirectUrl);
    });
});

// POST /routines/remove-exercise - Remove exercise from temp
router.post('/remove-exercise', redirectLogin, (req, res) => {
    req.body.index = req.sanitize(req.body.index);
    req.body.query = req.sanitize(req.body.query); // Get query to persist it
    const index = parseInt(req.body.index);
    const query = req.body.query;

    if (req.session.tempRoutine && req.session.tempRoutine.exercises) {
        // Remove exercise at specified index
        req.session.tempRoutine.exercises.splice(index, 1);
    }
    req.session.save(() => {
        const redirectUrl = query ? `/routines/new?query=${encodeURIComponent(query)}` : '/routines/new';
        res.redirectBase(redirectUrl);
    });
});

// POST /routines - Save routine
router.post('/', redirectLogin, (req, res) => {
    req.body.routine_name = req.sanitize(req.body.routine_name);
    req.body.description = req.sanitize(req.body.description);
    const userId = req.session.user.id;
    const { routine_name, description } = req.body;
    const exercises = req.session.tempRoutine?.exercises || [];
    // Use a transaction to save routine and exercises atomically
    db.getConnection((err, connection) => {
        if (err) {
            console.error('Connection error:', err);
            return res.status(500).send('Database connection error');
        }
        // Connection handling
        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).send('Transaction error');
            }
            // Insert routine
            const routineQuery = 'INSERT INTO routines (user_id, routine_name, description) VALUES (?, ?, ?)';
            connection.query(routineQuery, [userId, routine_name, description], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).send('Error creating routine');
                    });
                }
                const routineId = result.insertId;
                if (exercises.length === 0) {
                    // No exercises to add, just commit routine
                    return connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error saving routine');
                            });
                        }
                        connection.release();
                        delete req.session.tempRoutine;
                        req.session.save(() => {
                            res.redirectBase('/routines');
                        });
                    });
                }
                // Prepare values for insert of exercises
                const exerciseValues = exercises.map((ex, index) => [
                    routineId,
                    ex.exercise_id || 0,
                    ex.exercise_name,
                    ex.sets || 3,
                    ex.reps || 10,
                    index
                ]);
                //Insert exercises
                const exerciseQuery = 'INSERT INTO routine_exercises (routine_id, exercise_id, exercise_name, sets, reps, order_index) VALUES ?';
                connection.query(exerciseQuery, [exerciseValues], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).send('Error adding exercises');
                        });
                    }
                    // Commit transaction after adding exercises if bothj succeed
                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send('Error saving routine');
                            });
                        }
                        connection.release();
                        delete req.session.tempRoutine;
                        req.session.save(() => {
                            res.redirectBase('/routines');
                        });
                    });
                });
            });
        });
    });
});

// GET /routines/json - View all routines with exercises as JSON
router.get('/json', redirectLogin, (req, res) => {
    const userId = req.session.user.id;

    // Query all routines for the user
    const routinesQuery = 'SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC';
    db.query(routinesQuery, [userId], (err, routines) => {
        if (err) {
            console.error('Error fetching routines:', err);
            return res.status(500).json({ error: 'Error loading routines' });
        }

        if (routines.length === 0) {
            // No routines found
            return res.json({
                success: true,
                count: 0,
                routines: []
            });
        }

        // Get all exercises for the found routines
        const routineIds = routines.map(r => r.routine_id);
        const exercisesQuery = 'SELECT * FROM routine_exercises WHERE routine_id IN (?) ORDER BY routine_id, order_index';

        db.query(exercisesQuery, [routineIds], (err, exercises) => {
            if (err) {
                console.error('Error fetching exercises:', err);
                return res.status(500).json({ error: 'Error loading exercises' });
            }

            // Attach exercises to their respective routines
            routines.forEach(routine => {
                routine.exercises = exercises.filter(ex => ex.routine_id === routine.routine_id);
            });

            // Return routines and exercises as JSON
            res.json({
                success: true,
                count: routines.length,
                routines: routines
            });
        });
    });
});

// POST /routines/delete - Delete a routine
router.post('/delete', redirectLogin, (req, res) => {
    req.body.routine_id = req.sanitize(req.body.routine_id);
    const routineId = req.body.routine_id;
    const userId = req.session.user.id;

    if (!routineId) {
        // No routine specified
        return res.redirectBase('/routines');
    }

    // Ensure the routine belongs to the user before deleting
    const deleteQuery = 'DELETE FROM routines WHERE routine_id = ? AND user_id = ?';

    db.query(deleteQuery, [routineId, userId], (err, result) => {
        if (err) {
            console.error('Error deleting routine:', err);
            return res.status(500).send('Error deleting routine');
        }

        console.log(`Routine ${routineId} deleted for user ${userId}`);
        res.redirectBase('/routines');
    });
});

// Export the router
module.exports = router;
