<?php
// AGZ Game Zone - Authentication API
//
// Actions (via ?action=...):
//   POST login          { username, password } -> starts a session
//   POST logout         -> ends the session
//   GET  me             -> current logged-in user, or 401 if not logged in
//   GET  list_users     -> (admin only) all user accounts
//   POST create_user    { username, password, displayName, role } -> (admin only)
//   POST delete_user    { id } -> (admin only)

session_start();
require __DIR__ . '/config.php';

header('Content-Type: application/json');
// Reflect the request origin (rather than "*") because credentialed requests
// (cookies) require a specific origin, not a wildcard.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function currentSessionUser() {
    if (!isset($_SESSION['user_id'])) return null;
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'displayName' => $_SESSION['display_name'],
        'role' => $_SESSION['role'],
    ];
}

function requireAdmin() {
    $u = currentSessionUser();
    if (!$u || $u['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required.']);
        exit;
    }
    return $u;
}

function jsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

$action = $_GET['action'] ?? '';

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = jsonBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password.']);
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['display_name'] = $user['display_name'];
    $_SESSION['role'] = $user['role'];

    echo json_encode(['success' => true, 'user' => currentSessionUser()]);
    exit;
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'me') {
    $u = currentSessionUser();
    if (!$u) {
        http_response_code(401);
        echo json_encode(['error' => 'Not logged in.']);
        exit;
    }
    echo json_encode(['user' => $u]);
    exit;
}

if ($action === 'list_users' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    requireAdmin();
    $stmt = $pdo->query("SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at");
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($action === 'create_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();
    $body = jsonBody();
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';
    $displayName = trim($body['displayName'] ?? $username);
    $role = in_array(($body['role'] ?? ''), ['admin', 'staff'], true) ? $body['role'] : 'staff';

    if ($username === '' || strlen($password) < 4) {
        http_response_code(400);
        echo json_encode(['error' => 'Username is required and password must be at least 4 characters.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)");
        $stmt->execute([$username, password_hash($password, PASSWORD_BCRYPT), $displayName, $role]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(400);
        echo json_encode(['error' => 'That username is already taken.']);
    }
    exit;
}

if ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $admin = requireAdmin();
    $body = jsonBody();
    $id = intval($body['id'] ?? 0);

    if ($id === intval($admin['id'])) {
        http_response_code(400);
        echo json_encode(['error' => "You can't delete the account you're currently logged in as."]);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action.']);
