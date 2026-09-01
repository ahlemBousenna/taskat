<?php
// --- update_task_status.php ---
// Handles AJAX requests to update a task's status.

require_once 'db.php';

// Set header to return JSON
header('Content-Type: application/json');

// Check if it's a POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// Get the posted data
$data = json_decode(file_get_contents('php://input'), true);

$task_id = $data['taskId'] ?? null;
$new_status = $data['newStatus'] ?? null;

// Validate input
if (!filter_var($task_id, FILTER_VALIDATE_INT) || empty($new_status)) {
    echo json_encode(['success' => false, 'message' => 'Invalid input.']);
    exit;
}

$allowed_statuses = ['not_started', 'in_progress', 'completed', 'late'];
if (!in_array($new_status, $allowed_statuses)) {
    echo json_encode(['success' => false, 'message' => 'Invalid status value.']);
    exit;
}

// Prepare and execute the update query
try {
    $sql = "UPDATE tasks SET status = :status WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    
    $stmt->bindParam(':status', $new_status, PDO::PARAM_STR);
    $stmt->bindParam(':id', $task_id, PDO::PARAM_INT);
    
    $stmt->execute();

    // Check if any row was actually updated
    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true]);
    } else {
        // This can happen if the task ID doesn't exist or the status was already set to the new value
        echo json_encode(['success' => false, 'message' => 'Task not found or status already updated.']);
    }

} catch (PDOException $e) {
    // Return a server error response
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
