const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'debug_server.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
}

module.exports = log;
