// Import required modules
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redirectLogin = require('../middleware/auth');
const expressSanitizer = require('express-sanitizer');

// Enable sanitization for this router
router.use(expressSanitizer());


// HELPER FUNCTIONS

// Helper to handle alerts and redirects using Session Flash messages
const flashAndRedirect = (req, res, type, message, redirectUrl = '/') => {
    // Store message in session
    req.session.flash = { type, message };

    // Explicitly save session before redirecting to ensure message isn't lost
    req.session.save((err) => {
        if (err) console.error('Error saving session during redirect:', err);
        res.redirectBase(redirectUrl);
    });
};

// BOOKING ROUTES

// POST: Handle Class Booking
router.post('/book', redirectLogin, (req, res) => {
    // 1. Sanitize Inputs
    req.body.schedule_id = req.sanitize(req.body.schedule_id);
    req.body.booking_date = req.sanitize(req.body.booking_date);

    const { schedule_id: scheduleId, booking_date: bookingDate } = req.body;
    const userId = req.session.user.id;

    console.log(`[BOOKING] Attempt started: User ${userId} -> Schedule ${scheduleId} on ${bookingDate}`);

    if (!bookingDate) {
        // Booking date is required
        console.warn(`[BOOKING] Failed: Missing booking date for User ${userId}`);
        return flashAndRedirect(req, res, 'error', 'Invalid booking date selected.');
    }

    // 2. Fetch Schedule Details
    const sql = `
        SELECT S.id, S.capacity, S.day, A.cost, A.tier_required, A.name as activity_name
        FROM schedule S
        JOIN activities A ON S.activity_id = A.id
        WHERE S.id = ?
    `;

    db.query(sql, [scheduleId], (err, result) => {
        if (err) {
            console.error(`[BOOKING] DB Error fetching schedule ${scheduleId}:`, err);
            return flashAndRedirect(req, res, 'error', 'System error fetching class details.');
        }

        if (result.length === 0) {
            // No such class found
            console.warn(`[BOOKING] Failed: Schedule ${scheduleId} not found.`);
            return flashAndRedirect(req, res, 'error', 'Class not found.');
        }

        const classInfo = result[0];
        const user = req.session.user;

        console.log(`[BOOKING] Class Info: ${classInfo.activity_name} (Cost: ${classInfo.cost}, Tier: ${classInfo.tier_required})`);

        // 3. Run Validation Checks (Pre-Transaction)

        // Check A: Current capacity
        const countSql = "SELECT COUNT(*) as count FROM bookings WHERE schedule_id = ? AND booking_date = ? AND status = 'confirmed'";
        db.query(countSql, [scheduleId, bookingDate], (err, countResult) => {
            if (err) {
                console.error(`[BOOKING] DB Error checking capacity for Sched ${scheduleId}:`, err);
                return flashAndRedirect(req, res, 'error', 'System error checking capacity.');
            }

            const currentBookings = countResult[0].count;

            // Check B: User already booked?
            const checkSql = 'SELECT * FROM bookings WHERE user_id = ? AND schedule_id = ? AND booking_date = ?';
            db.query(checkSql, [userId, scheduleId, bookingDate], (err, existingBookings) => {
                if (err) {
                    console.error(`[BOOKING] DB Error checking existing bookings User ${userId}:`, err);
                    return flashAndRedirect(req, res, 'error', 'System error checking bookings.');
                }

                // --- Validation Logic ---
                if (existingBookings.length > 0) {
                    // User already booked this class
                    console.log(`[BOOKING] Rejected: User ${userId} already booked Sched ${scheduleId}`);
                    return flashAndRedirect(req, res, 'error', 'You have already booked this class!');
                }

                if (currentBookings >= classInfo.capacity) {
                    // Class is full
                    console.log(`[BOOKING] Rejected: Class Full (${currentBookings}/${classInfo.capacity})`);
                    return flashAndRedirect(req, res, 'error', 'Class is full!');
                }

                if (user.token_balance < classInfo.cost) {
                    // Not enough tokens
                    console.log(`[BOOKING] Rejected: Insufficient Funds (User: ${user.token_balance}, Cost: ${classInfo.cost})`);
                    return flashAndRedirect(req, res, 'error', 'Insufficient tokens! Please top up.');
                }

                // Check C: Membership Tier Logic
                const userTierValue = user.membership_tier === 'gold' ? 3 : (user.membership_tier === 'silver' ? 2 : 1);
                if (classInfo.tier_required > userTierValue) {
                    // User's membership tier is too low
                    console.log(`[BOOKING] Rejected: Tier Mismatch (Required: ${classInfo.tier_required}, User: ${userTierValue})`);
                    return flashAndRedirect(req, res, 'error', 'This class requires a higher membership tier!');
                }

                // 4. Start Transaction (Atomic Operation)
                db.getConnection((err, connection) => {
                    if (err) {
                        console.error('[BOOKING] Connection Pool Error:', err);
                        return flashAndRedirect(req, res, 'error', 'Database connection failed.');
                    }

                    connection.beginTransaction(err => {
                        if (err) {
                            connection.release();
                            console.error('[BOOKING] Transaction Start Error:', err);
                            return flashAndRedirect(req, res, 'error', 'Transaction initialization failed.');
                        }

                        // Step 4a: Insert Booking
                        const insertBooking = 'INSERT INTO bookings (user_id, schedule_id, status, booking_date) VALUES (?, ?, "confirmed", ?)';
                        connection.query(insertBooking, [userId, scheduleId, bookingDate], (err) => {
                            if (err) {
                                // Rollback if booking insert fails
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('[BOOKING] Insert Failed:', err);
                                    flashAndRedirect(req, res, 'error', 'Booking failed. Please try again.');
                                });
                            }

                            // Step 4b: Deduct Tokens
                            const updateTokens = 'UPDATE users SET token_balance = token_balance - ? WHERE id = ?';
                            connection.query(updateTokens, [classInfo.cost, userId], (err) => {
                                if (err) {
                                    // Rollback if token deduction fails
                                    return connection.rollback(() => {
                                        connection.release();
                                        console.error('[BOOKING] Token Deduct Failed:', err);
                                        flashAndRedirect(req, res, 'error', 'Failed to process payment.');
                                    });
                                }

                                // Step 4c: Commit
                                connection.commit(err => {
                                    if (err) {
                                        // Rollback if commit fails
                                        return connection.rollback(() => {
                                            connection.release();
                                            console.error('[BOOKING] Commit Failed:', err);
                                            flashAndRedirect(req, res, 'error', 'System error finalizing booking.');
                                        });
                                    }

                                    connection.release();

                                    // 5. Update Session & Success
                                    req.session.user.token_balance -= classInfo.cost;
                                    console.log(`[BOOKING] Success: User ${userId} booked Sched ${scheduleId}. New Balance: ${req.session.user.token_balance}`);

                                    flashAndRedirect(req, res, 'success', 'Class booked successfully!', '/dashboard');
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// CANCELLATION ROUTES

// POST: Handle Class Cancellation
router.post('/cancel', redirectLogin, (req, res) => {
    req.body.booking_id = req.sanitize(req.body.booking_id);
    const { booking_id } = req.body;
    const userId = req.session.user.id;

    console.log(`[CANCEL] Attempt started: User ${userId} -> Booking ${booking_id}`);

    db.getConnection((err, connection) => {
        if (err) {
            console.error('[CANCEL] Connection Error:', err);
            return flashAndRedirect(req, res, 'error', 'System error.');
        }

        // 1. Start Transaction
        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error('[CANCEL] Transaction Error:', err);
                return flashAndRedirect(req, res, 'error', 'System error.');
            }

            // 2. Fetch Booking & Cost
            const getBookingSql = `
                SELECT b.id, a.cost, a.name 
                FROM bookings b
                JOIN schedule s ON b.schedule_id = s.id
                JOIN activities a ON s.activity_id = a.id
                WHERE b.id = ? AND b.user_id = ?
            `;

            connection.query(getBookingSql, [booking_id, userId], (err, results) => {
                if (err || results.length === 0) {
                    // Booking not found or not owned by user
                    return connection.rollback(() => {
                        connection.release();
                        console.warn(`[CANCEL] Failed: Booking ${booking_id} not found/owned by User ${userId}`);
                        flashAndRedirect(req, res, 'error', 'Booking not found.', '/dashboard');
                    });
                }

                const cost = results[0].cost;
                console.log(`[CANCEL] Found Booking: ${results[0].name} (Refund Amount: ${cost})`);

                // 3. Delete Booking
                const deleteSql = 'DELETE FROM bookings WHERE id = ?';
                connection.query(deleteSql, [booking_id], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error('[CANCEL] Delete Failed:', err);
                            flashAndRedirect(req, res, 'error', 'Cancellation failed.');
                        });
                    }

                    // 4. Refund Tokens
                    const refundSql = 'UPDATE users SET token_balance = token_balance + ? WHERE id = ?';
                    connection.query(refundSql, [cost, userId], (err) => {
                        if (err) {
                            // Rollback if refund fails
                            return connection.rollback(() => {
                                connection.release();
                                console.error('[CANCEL] Refund Failed:', err);
                                flashAndRedirect(req, res, 'error', 'Refund failed.');
                            });
                        }

                        // 5. Commit
                        connection.commit(err => {
                            if (err) {
                                // Rollback if commit fails
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('[CANCEL] Commit Failed:', err);
                                    flashAndRedirect(req, res, 'error', 'System error.');
                                });
                            }

                            connection.release();

                            // 6. Update Session & Success
                            req.session.user.token_balance += cost;
                            console.log(`[CANCEL] Success: Refunded ${cost} to User ${userId}`);

                            flashAndRedirect(req, res, 'success', 'Booking cancelled and tokens refunded.', '/dashboard');
                        });
                    });
                });
            });
        });
    });
});

// Export the router
module.exports = router;