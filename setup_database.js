const mysql = require('mysql2');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const connection = mysql.createConnection({
    host: process.env.HEALTH_HOST,
    user: process.env.HEALTH_USER,
    password: process.env.HEALTH_PASSWORD,
    multipleStatements: true // Allow multiple SQL statements
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL server:', err);
        return;
    }
    console.log('Connected to MySQL server.');

    const sql = fs.readFileSync(path.join(__dirname, 'create_db.sql'), 'utf8');

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error executing SQL script:', err);
        } else {
            console.log('Database and tables created successfully.');
        }
        connection.end();
    });
});
