const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Register Page
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

// Register Handler
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    // Simple validation
    if (!username || !email || !password) {
        return res.render('register', { title: 'Register', error: 'Please fill in all fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(sql, [username, email, hashedPassword], (err, result) => {
            if (err) {
                console.error(err);
                return res.render('register', { title: 'Register', error: 'Error registering user' });
            }
            res.redirect('/users/login');
        });
    } catch (err) {
        console.error(err);
        res.render('register', { title: 'Register', error: 'Server error' });
    }
});

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Login Handler
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;

                if (isMatch) {
                    req.session.userId = user.id;
                    req.session.username = user.username;
                    res.redirect('/dashboard');
                } else {
                    res.render('login', { title: 'Login', error: 'Incorrect password' });
                }
            });
        } else {
            res.render('login', { title: 'Login', error: 'No user found with that email' });
        }
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/users/login');
    });
});

module.exports = router;
