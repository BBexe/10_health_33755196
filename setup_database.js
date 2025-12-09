const mysql = require('mysql2');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const connection = mysql.createConnection({
    host: process.env.HEALTH_HOST,
    user: process.env.HEALTH_USER,
    password: process.env.HEALTH_PASSWORD,
    multipleStatements: true // This allows us to run the whole file at once
});

// Simple helper to run a full SQL file
const runSqlFile = (fileName) => {
    const filePath = path.join(__dirname, fileName);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    return new Promise((resolve, reject) => {
        console.log(`Executing ${fileName}...`);
        connection.query(sql, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

// Main execution
console.log('Connected to MySQL server.');

// Check if the 'Users' table exists to decide whether to run setup
connection.query("SHOW TABLES LIKE 'Users'", (err, results) => {
    if (err) {
        console.error('Error checking database state:', err);
        connection.end();
        return;
    }

    if (results.length > 0) {
        // Tables exist. Don't overwrite them!
        console.log('Database tables already exist.');
        console.log('Skipping setup to preserve your data.');
        console.log('(To force a reset, drop the tables manually or edit this script)');
        connection.end();
    } else {
        // Tables don't exist Run the setup!
        console.log('New environment detected. Initializing database...');
        
        runSqlFile('create_db.sql')
            .then(() => {
                console.log('Database structure created.');
                return runSqlFile('insert_test_data.sql');
            })
            .then(() => {
                console.log('Test data inserted.');
                console.log('Database setup complete!');
                connection.end();
            })
            .catch(err => {
                console.error('Database setup failed:', err);
                connection.end();
            });
    }
});
