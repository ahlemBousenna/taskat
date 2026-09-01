<?php
// --- migrate_tasks.php ---
// Handles migrating unfinished tasks to the next day.

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
    // 1. Get current group details
    $stmt_group = $pdo->prepare("SELECT * FROM task_groups WHERE id = ?");
    $stmt_group->execute([$group_id]);
    $current_group = $stmt_group->fetch(PDO::FETCH_ASSOC);

    if (!$current_group) {
        echo json_encode(['success' => false, 'message' => 'Group not found.']);
        exit;
    }

    // 2. Find all unfinished tasks in the current group
    $stmt_tasks = $pdo->prepare("SELECT id FROM tasks WHERE group_id = ? AND status != 'completed'");
    $stmt_tasks->execute([$group_id]);
    $unfinished_tasks = $stmt_tasks->fetchAll(PDO::FETCH_COLUMN);

    if (empty($unfinished_tasks)) {
        echo json_encode(['success' => false, 'message' => 'لا توجد مهام غير مكتملة لترحيلها.']);
        exit;
    }

    // 3. Determine the next day's date
    $next_day_date = date('Y-m-d', strtotime($current_group['date'] . ' +1 day'));

    // 4. Find or create a group for the next day
    $stmt_next_group = $pdo->prepare("SELECT id FROM task_groups WHERE name = ? AND date = ?");
    $stmt_next_group->execute([$current_group['name'], $next_day_date]);
    $next_group_id = $stmt_next_group->fetchColumn();

    if (!$next_group_id) {
        // Create a new group if it doesn't exist
        $stmt_create = $pdo->prepare("INSERT INTO task_groups (name, color, date) VALUES (?, ?, ?)");
        $stmt_create->execute([$current_group['name'], $current_group['color'], $next_day_date]);
        $next_group_id = $pdo->lastInsertId();
    }

    // 5. Move tasks to the new group and update their migration date
    $pdo->beginTransaction();
    $stmt_update_task = $pdo->prepare("UPDATE tasks SET group_id = ?, migrated_from_date = ? WHERE id = ?");
    foreach ($unfinished_tasks as $task_id) {
        // The migration date is the date of the *current* group
        $stmt_update_task->execute([$next_group_id, $current_group['date'], $task_id]);
    }
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'تم ترحيل المهام بنجاح!']);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
