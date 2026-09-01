<?php
// --- update_task.php ---
// This script handles the form submission for editing an existing task.

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Sanitize and retrieve POST data
    $task_id = filter_input(INPUT_POST, 'task_id', FILTER_VALIDATE_INT);
    $title = trim(filter_input(INPUT_POST, 'title', FILTER_SANITIZE_STRING));
    // Allow more tags for description if needed, but for now, basic sanitization is fine.
    $description = trim(filter_input(INPUT_POST, 'description', FILTER_SANITIZE_STRING));

    // 2. Validation
    if (!$task_id || empty($title)) {
        // Redirect with an error if validation fails
        header('Location: task.php?id=' . $task_id . '&error=invalid_input');
        exit;
    }

    // 3. Prepare and execute the SQL UPDATE statement
    try {
        $sql = "UPDATE tasks SET title = :title, description = :description WHERE id = :id";
        $stmt = $pdo->prepare($sql);

        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':id', $task_id);

        $stmt->execute();

        // 4. Redirect back to the task page to show the updated data
        header('Location: task.php?id=' . $task_id . '&success=updated');
        exit;

    } catch (PDOException $e) {
        die("Error updating task: " . $e->getMessage());
    }
} else {
    // Redirect to home if accessed directly
    header('Location: index.php');
    exit;
}
?>
