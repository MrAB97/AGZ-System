<?php
// AGZ Game Zone - Database Connection
// Default XAMPP MySQL credentials are root with no password. Change these if
// you set a MySQL password or are using WAMP/MAMP with different defaults.

$DB_HOST = '127.0.0.1';
$DB_NAME = 'agz_game_zone';
$DB_USER = 'root';
$DB_PASS = '';

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Database connection failed.',
        'details' => $e->getMessage(),
        'hint' => 'Make sure MySQL is running in the XAMPP Control Panel and that you ran schema.sql in phpMyAdmin.',
    ]);
    exit;
}
