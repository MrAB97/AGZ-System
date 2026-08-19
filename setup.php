<?php
// AGZ Game Zone - First-Time Admin Setup
//
// Run this ONCE in your browser after importing schema.sql:
//   http://localhost/agz-backend/setup.php
//
// It creates (or resets) the admin account below with a properly hashed
// password. After running it, DELETE THIS FILE and change the password
// from inside the app (or by re-running this script with new values).

require __DIR__ . '/config.php';

// ---- Change these before running if you want a different starting login ----
$username    = 'admin';
$password    = 'admin123';
$displayName = 'Administrator';
// ------------------------------------------------------------------------

$hash = password_hash($password, PASSWORD_BCRYPT);

$stmt = $pdo->prepare(
    "INSERT INTO users (username, password_hash, display_name, role)
     VALUES (:username, :hash, :display_name, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), display_name = VALUES(display_name)"
);
$stmt->execute([
    ':username' => $username,
    ':hash' => $hash,
    ':display_name' => $displayName,
]);

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AGZ Setup</title></head>
<body style="font-family: sans-serif; background:#060911; color:#e2e8f0; padding:2rem; max-width:520px; margin:auto;">
    <h1 style="color:#00f0ff;">Admin account ready</h1>
    <p>You can now log in to AGZ Game Zone with:</p>
    <p>Username: <b><?= htmlspecialchars($username) ?></b><br>
       Password: <b><?= htmlspecialchars($password) ?></b></p>
    <p style="color:#ff007f; font-weight:bold;">
        Please delete this file (setup.php) now, and change this password
        after your first login using Manage Users in the app.
    </p>
</body>
</html>
