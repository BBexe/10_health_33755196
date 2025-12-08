DROP DATABASE IF EXISTS health;
CREATE DATABASE health;
USE health;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    firstname VARCHAR(50),
    lastname VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    token_balance INT DEFAULT 50,
    membership_type ENUM('guest', 'member', 'admin') DEFAULT 'guest',
    membership_tier ENUM('none', 'silver', 'gold') DEFAULT 'none'
);

CREATE TABLE login_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50),
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('success', 'failure')
);

CREATE TABLE Activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cost INT DEFAULT 10,
    tier_required INT DEFAULT 1
);

CREATE TABLE Schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT,
    day VARCHAR(20),
    start_time TIME,
    capacity INT DEFAULT 20,
    FOREIGN KEY (activity_id) REFERENCES Activities(id)
);

CREATE TABLE Bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    schedule_id INT,
    status VARCHAR(20) DEFAULT 'confirmed',
    booking_date DATE,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (schedule_id) REFERENCES Schedule(id)
);

CREATE TABLE User_Stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    weight DECIMAL(5,2),
    date_logged DATE,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES Users(id)
);
