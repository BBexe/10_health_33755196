const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');
const expressSanitizer = require('express-sanitizer');

router.use(expressSanitizer());

// Handle Booking
router.post('/book', redirectLogin, (req, res) => {
    req.body.schedule_id = req.sanitize(req.body.schedule_id);
    req.body.booking_date = req.sanitize(req.body.booking_date);
    const scheduleId = req.body.schedule_id;
    const userId = req.session.user.id;
    const bookingDate = req.body.booking_date;

    const sendError = (message) => {
        res.send(`<script>alert("${message}"); window.location.href="/";</script>`);
    };

    if (!bookingDate) return sendError("Invalid booking date!");

    // 1. Get Schedule and Activity Details
    const sql = `
        SELECT S.id, S.capacity, S.day, A.cost, A.tier_required
        FROM Schedule S
        JOIN Activities A ON S.activity_id = A.id
        WHERE S.id = ?
    `;

    db.query(sql, [scheduleId], (err, result) => {
        if (err) { console.error(err); return sendError('Database error'); }
        if (result.length === 0) return sendError('Class not found');

        const classInfo = result[0];
        const user = req.session.user;

        // Get current bookings for this specific date
        const countSql = "SELECT COUNT(*) as count FROM Bookings WHERE schedule_id = ? AND booking_date = ? AND status = 'confirmed'";
        db.query(countSql, [scheduleId, bookingDate], (err, countResult) => {
            if (err) { console.error(err); return sendError('Error counting bookings'); }
            
            const currentBookings = countResult[0].count;

            // Check 0: Already booked
            const checkSql = 'SELECT * FROM Bookings WHERE user_id = ? AND schedule_id = ? AND booking_date = ?';
            db.query(checkSql, [userId, scheduleId, bookingDate], (err, existingBookings) => {
                if (err) { console.error(err); return sendError('Error checking bookings'); }
                
                if (existingBookings.length > 0) {
                    return sendError("You have already booked this class!");
                }

                // Check 1: Capacity
                if (currentBookings >= classInfo.capacity) {
                    return sendError("Class is full!");
                }

                // Check 2: Balance
                if (user.token_balance < classInfo.cost) {
                    return sendError("Insufficient tokens!");
                }

                // Check 3: Tier
                const userTierValue = user.membership_tier === 'gold' ? 3 : (user.membership_tier === 'silver' ? 2 : 1);
                if (classInfo.tier_required > userTierValue) {
                    return sendError("This class requires a higher membership tier!");
                }

                // Action: Insert Booking and Deduct Tokens
                db.getConnection((err, connection) => {
                    if (err) { console.error(err); return sendError('Database connection error'); }

                    connection.beginTransaction(err => {
                        if (err) { 
                            connection.release();
                            console.error(err); 
                            return sendError('Error starting transaction'); 
                        }

                        const insertBooking = 'INSERT INTO Bookings (user_id, schedule_id, status, booking_date) VALUES (?, ?, "confirmed", ?)';
                        connection.query(insertBooking, [userId, scheduleId, bookingDate], (err, result) => {
                            if (err) { 
                                connection.rollback(() => { 
                                    connection.release();
                                    console.error(err); 
                                    sendError('Error booking'); 
                                });
                                return;
                            }

                            const updateTokens = 'UPDATE Users SET token_balance = token_balance - ? WHERE id = ?';
                            connection.query(updateTokens, [classInfo.cost, userId], (err, result) => {
                                if (err) {
                                    connection.rollback(() => { 
                                        connection.release();
                                        console.error(err); 
                                        sendError('Error updating tokens'); 
                                    });
                                    return;
                                }

                                connection.commit(err => {
                                    if (err) {
                                        connection.rollback(() => { 
                                            connection.release();
                                            console.error(err); 
                                            sendError('Error committing'); 
                                        });
                                        return;
                                    }
                                    
                                    connection.release();
                                    // Update session
                                    req.session.user.token_balance -= classInfo.cost;
                                    req.session.save(() => {
                                        res.redirect('/dashboard');
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Handle Cancellation
router.post('/cancel', redirectLogin, (req, res) => {
    req.body.booking_id = req.sanitize(req.body.booking_id);
    const { booking_id } = req.body;
    const userId = req.session.user.id;

    // 1. Get booking details to find cost
    const getBookingSql = `
        SELECT b.id, a.cost 
        FROM Bookings b
        JOIN Schedule s ON b.schedule_id = s.id
        JOIN Activities a ON s.activity_id = a.id
        WHERE b.id = ? AND b.user_id = ?
    `;

    db.query(getBookingSql, [booking_id, userId], (err, results) => {
        if (err) {
            console.error('Error fetching booking:', err);
            return res.send('Error fetching booking details');
        }

        if (results.length === 0) {
            console.log(`Booking ${booking_id} not found or already cancelled.`);
            return res.redirect('/dashboard');
        }

        const cost = results[0].cost;
        console.log(`Found booking ${booking_id} with cost ${cost}. Proceeding with cancellation.`);

        // 2. Delete booking FIRST, then refund (atomic operation protection)
        const deleteSql = 'DELETE FROM Bookings WHERE id = ? AND user_id = ?';
        db.query(deleteSql, [booking_id, userId], (err, deleteResult) => {
            if (err) {
                console.error('Error cancelling booking:', err);
                return res.send('Error cancelling booking');
            }

            // Check if a row was actually deleted
            if (deleteResult.affectedRows === 0) {
                console.log(`Booking ${booking_id} was already deleted. No refund issued.`);
                return res.redirect('/dashboard');
            }

            console.log(`Booking ${booking_id} cancelled. Refunding ${cost} tokens to user ${userId}.`);

            // 3. Refund tokens ONLY if booking was actually deleted
            const refundSql = 'UPDATE Users SET token_balance = token_balance + ? WHERE id = ?';
            db.query(refundSql, [cost, userId], (err) => {
                if (err) {
                    console.error('Error refunding tokens:', err);
                    // Try to restore the booking since refund failed
                    db.query('INSERT INTO Bookings (id, user_id, schedule_id, booking_date) SELECT ?, user_id, schedule_id, booking_date FROM Bookings WHERE id = ?', [booking_id, booking_id]);
                    return res.send('Error refunding tokens');
                }
                console.log('Tokens refunded successfully.');

                // Update session
                req.session.user.token_balance += cost;
                req.session.save(() => {
                    res.redirect('/dashboard');
                });
            });
        });
    });
});

module.exports = router;
