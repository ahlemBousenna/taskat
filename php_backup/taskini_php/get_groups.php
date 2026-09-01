<?php
// --- get_groups.php ---
// This file is called by AJAX from script.js to fetch groups for a specific date.

header('Content-Type: application/json');
require_once 'db.php';

// 1. Validate the date input
$date = $_GET['date'] ?? '';
if (!preg_match("/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/", $date)) {
    echo json_encode([]); // Return empty array if date is invalid
    exit;
}

try {
    // 2. Prepare statement to get groups for the selected date
    $stmt_groups = $pdo->prepare("SELECT * FROM task_groups WHERE date = ? ORDER BY created_at DESC");
    $stmt_groups->execute([$date]);
    $groups = $stmt_groups->fetchAll(PDO::FETCH_ASSOC);

    // 3. For each group, count its tasks
    $stmt_task_count = $pdo->prepare("SELECT COUNT(id) as count FROM tasks WHERE group_id = ?");

    // We use a loop to add the task count to each group object
    foreach ($groups as $key => $group) {
        $stmt_task_count->execute([$group['id']]);
        $count_result = $stmt_task_count->fetch(PDO::FETCH_ASSOC);
        // Add the count to the group array
        $groups[$key]['task_count'] = $count_result['count'] ?? 0;
    }

    // 4. Return the final array as JSON
    echo json_encode($groups);

} catch (PDOException $e) {
    // In case of a database error, return an empty array and log the error
    // For a real application, you'd want to log this error to a file
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
