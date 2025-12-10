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

CREATE TABLE Routines (
    routine_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    routine_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Routine_Exercises (
    routine_exercise_id INT PRIMARY KEY AUTO_INCREMENT,
    routine_id INT NOT NULL,
    exercise_id INT NOT NULL COMMENT 'Wger API exercise ID',
    exercise_name VARCHAR(200) NOT NULL COMMENT 'Cached from Wger API',
    sets INT DEFAULT 3,
    reps INT DEFAULT 10,
    order_index INT NOT NULL COMMENT 'Display order within routine',
    notes TEXT COMMENT 'User notes for this exercise',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (routine_id) REFERENCES Routines(routine_id) ON DELETE CASCADE,
    INDEX idx_routine_id (routine_id),
    INDEX idx_exercise_id (exercise_id),
    INDEX idx_order_index (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
