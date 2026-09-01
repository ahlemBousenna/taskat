<?php
// --- upload_file.php ---

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $task_id = filter_input(INPUT_POST, 'task_id', FILTER_VALIDATE_INT);

    if (!$task_id || !isset($_FILES['task_file']) || $_FILES['task_file']['error'] !== UPLOAD_ERR_OK) {
        header('Location: task.php?id=' . $task_id . '&error=upload_failed');
        exit;
    }

    $file = $_FILES['task_file'];
    $original_filename = basename($file['name']);
    
    // Create uploads directory if it doesn't exist
    $upload_dir = __DIR__ . '/uploads/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Generate a unique filename to prevent overwriting
    $file_extension = pathinfo($original_filename, PATHINFO_EXTENSION);
    $stored_filename = uniqid('file_', true) . '.' . $file_extension;
    $file_path = 'uploads/' . $stored_filename;
    $destination = $upload_dir . $stored_filename;

    // Check file size (Example: 100MB limit)
    // Note: Your php.ini `upload_max_filesize` and `post_max_size` must be configured to allow this.
    $max_size = 100 * 1024 * 1024; // 100 MB
    if ($file['size'] > $max_size) {
        header('Location: task.php?id=' . $task_id . '&error=file_too_large');
        exit;
    }

    // Move the file to the destination
    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // File moved successfully, now insert into database
        try {
            $sql = "INSERT INTO task_files (task_id, original_filename, stored_filename, file_path) VALUES (?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$task_id, $original_filename, $stored_filename, $file_path]);

            header('Location: task.php?id=' . $task_id . '&success=file_uploaded');
            exit;
        } catch (PDOException $e) {
            // If DB insert fails, delete the uploaded file
            unlink($destination);
            die("Database error: " . $e->getMessage());
        }
    } else {
        header('Location: task.php?id=' . $task_id . '&error=move_failed');
        exit;
    }
} else {
    header('Location: index.php');
    exit;
}
?>
