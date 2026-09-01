<?php
// --- delete_task.php ---
// This script handles deleting a task.

require_once 'db.php';

// 1. Get Task ID and Group ID from URL and validate them
$task_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$group_id = filter_input(INPUT_GET, 'group_id', FILTER_VALIDATE_INT);

if (!$task_id || !$group_id) {
    // If IDs are invalid, redirect to the main page
    header('Location: index.php');
    exit;
}

try {
    // 2. Prepare and execute the SQL DELETE statement
    $sql = "DELETE FROM tasks WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$task_id]);

    // 3. Redirect back to the group page to show the updated list
    header('Location: group.php?id=' . $group_id);
    exit;

} catch (PDOException $e) {
    // Handle potential database errors
    die("Error deleting task: " . $e->getMessage());
}
?>
