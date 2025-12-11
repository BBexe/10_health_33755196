const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { check, validationResult } = require('express-validator');
const redirectLogin = require('../middleware/auth');
const expressSanitizer = require('express-sanitizer');

router.use(expressSanitizer());

// Register Page
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register', error: null });
});

// Register Handler
router.post('/register', [
    check('username').notEmpty().withMessage('Username is required').trim().escape(),
    check('firstname').notEmpty().withMessage('First name is required').trim().escape(),
    check('lastname').notEmpty().withMessage('Last name is required').trim().escape(),
    check('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    console.log('Register attempt:', req.body);
    req.body.username = req.sanitize(req.body.username);
    req.body.firstname = req.sanitize(req.body.firstname);
    req.body.lastname = req.sanitize(req.body.lastname);
    req.body.email = req.sanitize(req.body.email);
    req.body.password = req.sanitize(req.body.password);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Register validation failed:', errors.array());
        return res.render('register', { 
            title: 'Register', 
            error: errors.array()[0].msg 
        });
    }

    const { username, firstname, lastname, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = 'INSERT INTO Users (username, firstname, lastname, email, password, ) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [username, firstname, lastname, email, hashedPassword], (err, result) => {
            if (err) {
                console.error('Database error during register:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.render('register', { title: 'Register', error: 'Username or Email already exists' });
                }
                return res.render('register', { title: 'Register', error: 'Error registering user' });
            }
            console.log('User registered successfully:', username);
            res.redirect('/users/login');
        });
    } catch (err) {
        console.error('Server error during register:', err);
        res.render('register', { title: 'Register', error: 'Server error' });
    }
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login', error: null });
});

// Login Handler
router.post('/login', [
    check('username').notEmpty().withMessage('Username is required').trim().escape(),
    check('password').notEmpty().withMessage('Password is required')
], (req, res) => {
    console.log('Login attempt for:', req.body.username);
    req.body.username = req.sanitize(req.body.username);
    req.body.password = req.sanitize(req.body.password);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { title: 'Login', error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    const sql = 'SELECT * FROM Users WHERE username = ?';
    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.render('login', { title: 'Login', error: 'System error during login' });
        }

        if (results.length > 0) {
            const user = results[0];
            
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Bcrypt error:', err);
                    return res.render('login', { title: 'Login', error: 'System error during login' });
                }

                if (isMatch) {
                    console.log('Login successful for:', username);
                    
                    // Manually construct the user object to avoid any hidden properties issues
                    const sessionUser = {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        token_balance: user.token_balance
                    };
                    
                    req.session.user = sessionUser;

                    req.session.save((err) => {
                        if (err) {
                            console.error('Session save error:', err);
                            return res.render('login', { title: 'Login', error: 'Session Error' });
                        }
                        res.redirect('/'); 
                    });
                } else {
                    console.log('Incorrect password for:', username);
                    res.render('login', { title: 'Login', error: 'Incorrect password' });
                }
            });
        } else {
            console.log('User not found:', username);
            res.render('login', { title: 'Login', error: 'No user found with that username' });
        }
    });
});

// Logout
router.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/users/login');
    });
});

module.exports = router;
