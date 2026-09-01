<?php
// (PHP logic remains the same)
require_once 'db.php';
$group_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$group_id) { header('Location: index.php'); exit; }
try {
    $stmt = $pdo->prepare("SELECT * FROM task_groups WHERE id = ?");
    $stmt->execute([$group_id]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$group) { header('Location: index.php'); exit; }
    $stmt_tasks = $pdo->prepare("SELECT * FROM tasks WHERE group_id = ? ORDER BY created_at ASC");
    $stmt_tasks->execute([$group_id]);
    $tasks = $stmt_tasks->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) { die("Error fetching group data: " . $e->getMessage()); }
$status_map = ['not_started' => 'لم يبدأ بعد', 'in_progress' => 'قيد التنفيذ', 'completed' => 'مكتمل', 'late' => 'متأخر'];
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مجموعة: <?php echo htmlspecialchars($group['name']); ?></title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <header class="group-header" style="background-color: <?php echo htmlspecialchars($group['color']); ?>;">
            <div>
                <h1><?php echo htmlspecialchars($group['name']); ?></h1>
                <p><?php echo formatAlgerianDate($group['date']); ?></p>
            </div>
            <!-- NEW: Container for header buttons -->
            <div class="group-header-buttons">
                <button id="migrate-tasks-btn" class="btn btn-secondary" data-group-id="<?php echo $group['id']; ?>">ترحيل المهام</button>
                <button id="add-task-btn" class="btn">مهمة جديدة +</button>
            </div>
        </header>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <a href="index.php" style="text-decoration: none; color: var(--accent-primary); font-weight: 500;">&larr; العودة للرئيسية</a>
            <button class="theme-switcher" id="theme-switcher" aria-label="تبديل الوضع">
                <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.41-1.41zM18.36 5.64c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41zm-12.73 12.73c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41z"/></svg>
                <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/></svg>
            </button>
        </div>

        <main>
            <ul class="tasks-list">
                <?php if (empty($tasks)): ?>
                    <li class="no-groups">لا توجد مهام في هذه المجموعة بعد.</li>
                <?php else: ?>
                    <?php foreach ($tasks as $task): ?>
                        <li class="task-item status-<?php echo $task['status']; ?>" data-task-id="<?php echo $task['id']; ?>">
                            <div class="task-content">
                                <a href="task.php?id=<?php echo $task['id']; ?>" class="task-title-link">
                                    <h4><?php echo htmlspecialchars($task['title']); ?></h4>
                                </a>
                                <!-- NEW: Show migration date if it exists -->
                                <?php if (!empty($task['migrated_from_date'])): ?>
                                    <p class="migrated-from">↬ تم ترحيلها من يوم <?php echo date('d/m/Y', strtotime($task['migrated_from_date'])); ?></p>
                                <?php endif; ?>
                                <?php if (!empty($task['description'])): ?>
                                    <p><?php echo htmlspecialchars(truncateDescription($task['description'], 18)); ?></p>
                                <?php endif; ?>
                            </div>
                            <div class="task-actions">
                                <select class="status-select status-badge status-<?php echo $task['status']; ?>" data-task-id="<?php echo $task['id']; ?>">
                                    <?php foreach ($status_map as $status_key => $status_value): ?>
                                        <option value="<?php echo $status_key; ?>" <?php if ($task['status'] === $status_key) echo 'selected'; ?>><?php echo $status_value; ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <a href="delete_task.php?id=<?php echo $task['id']; ?>&group_id=<?php echo $group_id; ?>" class="action-btn" title="حذف" onclick="return confirm('هل أنت متأكد من حذف هذه المهمة؟');">
                                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                                </a>
                            </div>
                        </li>
                    <?php endforeach; ?>
                <?php endif; ?>
            </ul>
        </main>
    </div>

    <!-- FIXED: Full modal content is now included -->
    <div id="task-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <h2>مهمة جديدة</h2>
            <form id="add-task-form" action="add_task.php" method="POST">
                <input type="hidden" name="group_id" value="<?php echo $group['id']; ?>">
                <div class="form-group">
                    <label for="task-title">عنوان المهمة (إجباري)</label>
                    <input type="text" id="task-title" name="title" required>
                </div>
                <div class="form-group">
                    <label for="task-description">الوصف (اختياري)</label>
                    <textarea id="task-description" name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="task-status">الحالة</label>
                    <select id="task-status" name="status">
                        <option value="not_started" selected>لم يبدأ بعد</option>
                        <option value="in_progress">قيد التنفيذ</option>
                        <option value="completed">مكتمل</option>
                        <option value="late">متأخر</option>
                    </select>
                </div>
                <button type="submit" class="btn">إضافة المهمة</button>
            </form>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
