<?php
// --- create_group.php ---
// This script handles the form submission for creating a new task group.

require_once 'db.php';

// Check if the form was submitted using POST method
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Sanitize and retrieve POST data
    $name = trim(filter_input(INPUT_POST, 'name', FILTER_SANITIZE_STRING));
    $color = trim(filter_input(INPUT_POST, 'color', FILTER_SANITIZE_STRING));
    $date = trim(filter_input(INPUT_POST, 'date', FILTER_SANITIZE_STRING));

    // 2. Basic Validation
    if (empty($name) || empty($color) || empty($date)) {
        // Handle error - for simplicity, we redirect back.
        // In a real app, you might show a more specific error message.
        header('Location: index.php?error=missing_fields');
        exit;
    }

    // 3. Prepare and execute the SQL INSERT statement
    try {
        $sql = "INSERT INTO task_groups (name, color, date) VALUES (:name, :color, :date)";
        $stmt = $pdo->prepare($sql);

        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':color', $color);
        $stmt->bindParam(':date', $date);

        $stmt->execute();

        // 4. Redirect back to the index page, showing the date of the newly created group
        header('Location: index.php'); // A simple redirect is enough
        exit;

    } catch (PDOException $e) {
        // Handle potential database errors during insertion
        die("Error creating group: " . $e->getMessage());
    }
} else {
    // If the script is accessed directly without a POST request, redirect to home
    header('Location: index.php');
    exit;
}
?>