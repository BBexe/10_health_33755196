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

    const executeSqlFile = (filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        return new Promise((resolve, reject) => {
            const runStatement = (index) => {
                if (index >= statements.length) {
                    resolve();
                    return;
                }
                const statement = statements[index];
                console.log(`Executing: ${statement.substring(0, 50)}...`);
                connection.query(statement, (err, results) => {
                    if (err) {
                        console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
                        reject(err);
                        return;
                    }
                    runStatement(index + 1);
                });
            };
            runStatement(0);
        });
    };

    executeSqlFile(path.join(__dirname, 'create_db.sql'))
        .then(() => {
            console.log('Database and tables created successfully.');
            return new Promise((resolve, reject) => {
                connection.query('SHOW TABLES FROM health', (err, results) => {
                    if (err) console.error('Error showing tables:', err);
                    else console.log('Tables in health database:', results);
                    resolve();
                });
            });
        })
        .then(() => {
            return executeSqlFile(path.join(__dirname, 'insert_test_data.sql'));
        })
        .then(() => {
            console.log('Test data inserted successfully.');
            connection.end();
        })
        .catch(err => {
            console.error('Database setup failed:', err);
            connection.end();
        });
});
