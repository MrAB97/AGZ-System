-- AGZ Game Zone - Database Schema
-- Run this once in phpMyAdmin (or the MySQL CLI) to create the database and tables.
--
-- Design note: each table stores one JSON "blob" per record (id + data).
-- This mirrors the JS objects the app already works with exactly, so the
-- frontend needed almost no rewriting to talk to this backend - it just
-- sends/receives the same JSON arrays it used to save to localStorage.
-- If you later want SQL-level reporting (e.g. "total revenue this month"),
-- these can be normalized into real columns - this version optimizes for
-- getting a working local backend quickly.

CREATE DATABASE IF NOT EXISTS agz_game_zone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agz_game_zone;

CREATE TABLE IF NOT EXISTS prices (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(64) PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- No default admin account is created here (a plaintext password in a SQL file
-- would sit in your project folder forever). Run setup.php once in your browser
-- after importing this schema - it creates the first admin account properly
-- hashed, then tells you to delete setup.php.

-- Tables start empty - the app will automatically seed them with the built-in
-- default demo data the first time it loads and finds the database empty.
-- (The "sales" table is the exception - it's a running transaction log and is
-- never auto-seeded, so it stays empty until real sales happen.)
