const mysql = require('mysql2');
try {
    const sql = 'SELECT * FROM Users WHERE id = ?';
    const params = [undefined];
    console.log('Params:', params);
    // We can't easily test the query without a connection, but we can check if the array construction throws.
    // It doesn't.
    console.log('Array construction successful');
} catch (e) {
    console.error('Error:', e);
}
