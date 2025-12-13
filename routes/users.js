const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { check, validationResult } = require('express-validator');
const redirectLogin = require('../middleware/auth');



// REGISTER ROUTES

// GET: Display Registration Form
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register', error: null });
});

// POST: Handle New User Registration
router.post('/register', [
    // Validation Rules
    check('username').notEmpty().withMessage('Username is required').trim().escape(),
    check('firstname').notEmpty().withMessage('First name is required').trim().escape(),
    check('lastname').notEmpty().withMessage('Last name is required').trim().escape(),
    check('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {

    // 1. Check for validation errors from the rules above
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', {
            title: 'Register',
            error: errors.array()[0].msg
        });
    }

    const { username, firstname, lastname, email, password } = req.body;

    try {
        // 2. Hash the password (Never store plain text passwords!)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Insert into Database
        const sql = 'INSERT INTO Users (username, firstname, lastname, email, password) VALUES (?, ?, ?, ?, ?)';

        db.query(sql, [username, firstname, lastname, email, hashedPassword], (err, result) => {
            if (err) {
                // --- DEBUGGING: detailed logs for DB errors ---
                console.error('DATABASE ERROR during Register:');
                console.error('Code:', err.code);
                console.error('Message:', err.sqlMessage);

                // Handle Duplicate User (Unique Constraint)
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.render('register', { title: 'Register', error: 'Username or Email already exists' });
                }

                // Generic DB Error
                return res.render('register', {
                    title: 'Register',
                    error: 'Database system error. Please try again.'
                });
            }

            console.log(`User registered successfully: ${username}`);
            res.redirect('/users/login');
        });

    } catch (err) {
        console.error('Server/Bcrypt error:', err);
        res.render('register', { title: 'Register', error: 'Server fatal error during registration.' });
    }
});


// LOGIN ROUTES


// GET: Display Login Form
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login', error: null });
});

// POST: Handle Login
router.post('/login', [
    check('username').notEmpty().withMessage('Username is required').trim(),
    check('password').notEmpty().withMessage('Password is required')
], (req, res) => {

    // 1. Validation Check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { title: 'Login', error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    // 2. Find user in Database
    const sql = 'SELECT * FROM Users WHERE username = ?';
    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.render('login', { title: 'Login', error: 'System error. Please try again.' });
        }

        // 3. Check if user exists
        if (results.length > 0) {
            const user = results[0];

            // 4. Compare submitted password with stored hash
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Bcrypt comparison error:', err);
                    return res.render('login', { title: 'Login', error: 'System error during verification.' });
                }

                if (isMatch) {
                    // 5. Create Session Object
                    // Explicitly include membership details here so the 
                    // booking logic (schedule.js) knows if the user is Gold/Silver/etc.
                    const sessionUser = {
                        id: user.id,
                        username: user.username,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        email: user.email,
                        token_balance: user.token_balance,
                        membership_type: user.membership_type,
                        membership_tier: user.membership_tier // Required for class restrictions
                    };

                    req.session.user = sessionUser;

                    // 6. Save Session & Redirect
                    req.session.save((err) => {
                        if (err) {
                            console.error('Session save error:', err);
                            return res.render('login', { title: 'Login', error: 'Error creating session.' });
                        }
                        res.redirect('/');
                    });
                } else {
                    // Password didn't match
                    res.render('login', { title: 'Login', error: 'Invalid username or password' });
                }
            });
        } else {
            // User not found
            res.render('login', { title: 'Login', error: 'Invalid username or password' });
        }
    });
});


// LOGOUT

router.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/users/login');
    });
});

module.exports = router;