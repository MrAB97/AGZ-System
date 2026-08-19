<?php
// AGZ Game Zone - Data API
//
// Usage:
//   GET  api.php?resource=prices        -> returns a JSON array of all records
//   POST api.php?resource=prices        -> body is a JSON array; replaces ALL records for that resource
//
// Valid resources: prices, media, tournaments, customers, stations, sales
//
// Auth: every request requires an active login session (see auth.php).
// Write access (POST) to prices/media/tournaments is restricted to admins -
// staff can still read them, but can't create/edit/delete tournaments, the
// media catalog, or pricing. customers/stations/sales stay writable by staff
// since starting sessions, billing, and loyalty point redemption legitimately
// need to update those.
//
// This intentionally does a full "replace all records" on POST rather than
// granular create/update/delete per item, to match how the frontend already
// keeps its whole dataset in memory and saves it as one call after any change.

session_start();
require __DIR__ . '/config.php';

header('Content-Type: application/json');
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

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}
$role = $_SESSION['role'];

$validResources = ['prices', 'media', 'tournaments', 'customers', 'stations', 'sales'];
$adminOnlyWrite = ['prices', 'media', 'tournaments'];

$resource = $_GET['resource'] ?? '';
if (!in_array($resource, $validResources, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or missing "resource" parameter. Must be one of: ' . implode(', ', $validResources)]);
    exit;
}

$table = $resource; // table names match resource names 1:1

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query("SELECT data FROM `$table`");
    $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $items = array_map(function ($json) {
        return json_decode($json, true);
    }, $rows);

    echo json_encode(array_values($items));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (in_array($resource, $adminOnlyWrite, true) && $role !== 'admin') {
        // Exception: allow the very first seed write even from a non-admin session, so a
        // brand new empty database still gets populated if a staff account happens to be
        // the first to log in. Once the table has data, admin-only kicks in for real.
        $countStmt = $pdo->query("SELECT COUNT(*) FROM `$table`");
        $isEmpty = $countStmt->fetchColumn() == 0;

        if (!$isEmpty) {
            http_response_code(403);
            echo json_encode(['error' => "Admin access required to modify $resource."]);
            exit;
        }
    }

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'Request body must be a JSON array of records.']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec("DELETE FROM `$table`");

        $stmt = $pdo->prepare("INSERT INTO `$table` (id, data) VALUES (:id, :data)");
        foreach ($body as $item) {
            if (!is_array($item) || !isset($item['id'])) {
                continue; // skip malformed entries rather than failing the whole save
            }
            $stmt->execute([
                ':id' => (string) $item['id'],
                ':data' => json_encode($item),
            ]);
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'count' => count($body)]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Save failed.', 'details' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed. Use GET or POST.']);
