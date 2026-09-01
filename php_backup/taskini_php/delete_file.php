<?php
// --- delete_file.php ---

require_once 'db.php';

$file_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$task_id = filter_input(INPUT_GET, 'task_id', FILTER_VALIDATE_INT);

if (!$file_id || !$task_id) {
    header('Location: index.php');
    exit;
}

try {
    // First, get the file path to delete it from the server
    $stmt = $pdo->prepare("SELECT file_path FROM task_files WHERE id = ?");
    $stmt->execute([$file_id]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($file) {
        // Delete the file from the server
        if (file_exists($file['file_path'])) {
            unlink($file['file_path']);
        }

        // Now, delete the record from the database
        $stmt_delete = $pdo->prepare("DELETE FROM task_files WHERE id = ?");
        $stmt_delete->execute([$file_id]);
    }

    header('Location: task.php?id=' . $task_id . '&success=file_deleted');
    exit;

} catch (PDOException $e) {
    die("Database error: " . $e->getMessage());
}
?>
