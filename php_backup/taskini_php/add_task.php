<?php
// --- add_task.php ---
// This script handles the form submission for adding a new task to a group.

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Sanitize and retrieve POST data
    $group_id = filter_input(INPUT_POST, 'group_id', FILTER_VALIDATE_INT);
    $title = trim(filter_input(INPUT_POST, 'title', FILTER_SANITIZE_STRING));
    $description = trim(filter_input(INPUT_POST, 'description', FILTER_SANITIZE_STRING));
    $status = trim(filter_input(INPUT_POST, 'status', FILTER_SANITIZE_STRING));

    // Allowed statuses
    $allowed_statuses = ['not_started', 'in_progress', 'completed', 'late'];

    // 2. Validation
    if (!$group_id || empty($title) || !in_array($status, $allowed_statuses)) {
        // Redirect with an error if validation fails
        header('Location: group.php?id=' . $group_id . '&error=invalid_input');
        exit;
    }

    // 3. Prepare and execute the SQL INSERT statement
    try {
        $sql = "INSERT INTO tasks (group_id, title, description, status) VALUES (:group_id, :title, :description, :status)";
        $stmt = $pdo->prepare($sql);

        $stmt->bindParam(':group_id', $group_id);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':status', $status);

        $stmt->execute();

        // 4. Redirect back to the group page
        header('Location: group.php?id=' . $group_id);
        exit;

    } catch (PDOException $e) {
        die("Error adding task: " . $e->getMessage());
    }
} else {
    // Redirect to home if accessed directly
    header('Location: index.php');
    exit;
}
?>
