USE health;

-- Clear existing data to prevent duplicates
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Bookings;
TRUNCATE TABLE Schedule;
TRUNCATE TABLE Activities;
TRUNCATE TABLE Users;
TRUNCATE TABLE login_audit;
TRUNCATE TABLE User_Stats;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Insert Users
-- Gold User (Password: 'smiths')
INSERT INTO Users (username, firstname, lastname, email, password, membership_type, membership_tier, token_balance)
VALUES ('gold', 'Goldie', 'Smith', 'gold@berties.com', '$2b$10$7Qksr7aQX6MBDp6MoP3xKunUtNTR/ULPwN0RaGnT5EjqHOU9l/wty', 'admin', 
'gold', 1000);                                                                                                                  

-- 2. Insert Activities
INSERT INTO Activities (name, description, cost, tier_required) VALUES
('Open Gym', 'General access to gym equipment', 10, 1),
('Yoga Flow', 'Relaxing vinyasa flow for all levels', 15, 2),
('Boxing', 'High intensity boxing workout', 20, 3),
('Zumba', 'High energy dance workout', 15, 2),
('Muay Thai', 'Traditional Thai martial arts training', 25, 3),
('Calisthenics', 'Bodyweight strength and conditioning', 20, 2),
('HIIT Blast', 'High Intensity Interval Training', 18, 2),
('Spin Class', 'Endurance cycling workout', 15, 2),
('Pilates', 'Core strength and flexibility', 18, 2),
('Powerlifting', 'Heavy lifting technique and strength', 20, 3),
('Meditation', 'Guided mindfulness session', 10, 1),
('CrossFit', 'Functional fitness workout', 22, 3);

-- 3. Insert Schedule
-- Monday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(1, 'Monday', '07:00:00', 50), -- Open Gym
(7, 'Monday', '09:00:00', 20), -- HIIT
(1, 'Monday', '12:00:00', 50), -- Open Gym
(2, 'Monday', '17:30:00', 15), -- Yoga
(3, 'Monday', '19:00:00', 12); -- Boxing

-- Tuesday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(1, 'Tuesday', '07:00:00', 50),
(8, 'Tuesday', '08:00:00', 20), -- Spin
(1, 'Tuesday', '12:00:00', 50),
(6, 'Tuesday', '18:00:00', 15), -- Calisthenics
(5, 'Tuesday', '19:30:00', 10); -- Muay Thai

-- Wednesday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(1, 'Wednesday', '07:00:00', 50),
(9, 'Wednesday', '09:00:00', 15), -- Pilates
(1, 'Wednesday', '12:00:00', 50),
(4, 'Wednesday', '18:00:00', 25), -- Zumba
(10, 'Wednesday', '19:30:00', 8); -- Powerlifting

-- Thursday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(1, 'Thursday', '07:00:00', 50),
(7, 'Thursday', '08:30:00', 20), -- HIIT
(1, 'Thursday', '12:00:00', 50),
(2, 'Thursday', '17:30:00', 15), -- Yoga
(5, 'Thursday', '19:00:00', 10); -- Muay Thai

-- Friday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(1, 'Friday', '07:00:00', 50),
(8, 'Friday', '09:00:00', 20), -- Spin
(1, 'Friday', '12:00:00', 50),
(3, 'Friday', '17:00:00', 12), -- Boxing
(11, 'Friday', '18:30:00', 20); -- Meditation

-- Saturday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(12, 'Saturday', '09:00:00', 15), -- CrossFit
(1, 'Saturday', '10:00:00', 50),
(4, 'Saturday', '11:00:00', 25), -- Zumba
(1, 'Saturday', '14:00:00', 50);

-- Sunday
INSERT INTO Schedule (activity_id, day, start_time, capacity) VALUES
(2, 'Sunday', '10:00:00', 20), -- Yoga
(1, 'Sunday', '11:00:00', 50),
(11, 'Sunday', '16:00:00', 20); -- Meditation

-- Insert sample routines for testing
INSERT INTO Routines (user_id, routine_name, description) VALUES
(1, 'Push Day', 'Upper body push exercises'),
(1, 'Pull Day', 'Upper body pull exercises'),
(1, 'Leg Day', 'Lower body workout');

-- CUSTOM ROUTINES TABLES


-- Table to store user-created workout routines
CREATE TABLE IF NOT EXISTS Routines (
    routine_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    routine_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store exercises within routines
CREATE TABLE IF NOT EXISTS Routine_Exercises (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
