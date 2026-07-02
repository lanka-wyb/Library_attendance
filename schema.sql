CREATE DATABASE IF NOT EXISTS library_attendance;
USE library_attendance;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    registration_number VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slots (Seats) table representing the physical seat layout
CREATE TABLE IF NOT EXISTS slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section VARCHAR(50) NOT NULL,            -- 'reading_l1', 'reading_l2', 'block_a', 'block_b'
    slot_number INT NOT NULL,                -- 1 to 100, or 1 to 50
    status VARCHAR(20) DEFAULT 'available',   -- 'available', 'occupied'
    occupied_by VARCHAR(50) NULL,            -- REFERENCES users(registration_number)
    occupied_at DATETIME NULL,
    UNIQUE KEY uq_section_slot (section, slot_number),
    FOREIGN KEY (occupied_by) REFERENCES users(registration_number) ON DELETE SET NULL
);

-- Attendance Logs table for tracking history
CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    registration_number VARCHAR(50) NOT NULL,
    section VARCHAR(50) NOT NULL,
    slot_number INT NOT NULL,
    checkin_time DATETIME NOT NULL,
    checkout_time DATETIME NULL,
    FOREIGN KEY (registration_number) REFERENCES users(registration_number)
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operators table
CREATE TABLE IF NOT EXISTS operators (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

