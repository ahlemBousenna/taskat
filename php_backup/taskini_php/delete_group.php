<?php
// --- delete_group.php ---
// Handles AJAX requests to delete a task group and its associated tasks.

require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$group_id = $data['groupId'] ?? null;

if (!filter_var($group_id, FILTER_VALIDATE_INT)) {
    echo json_encode(['success' => false, 'message' => 'Invalid Group ID.']);
    exit;
}

try {
    // Begin a transaction
    $pdo->beginTransaction();

    // The ON DELETE CASCADE in the tasks table foreign key will handle deleting tasks.
    // So we only need to delete the group.
    $sql = "DELETE FROM task_groups WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$group_id]);

    // Commit the transaction
    $pdo->commit();

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    // Roll back the transaction if something failed
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
