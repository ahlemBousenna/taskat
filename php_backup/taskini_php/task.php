<?php
require_once 'db.php';

$task_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$task_id) { header('Location: index.php'); exit; }

try {
    // Fetch task details
    $sql_task = "SELECT tasks.*, task_groups.name as group_name, task_groups.color as group_color FROM tasks JOIN task_groups ON tasks.group_id = task_groups.id WHERE tasks.id = ?";
    $stmt_task = $pdo->prepare($sql_task);
    $stmt_task->execute([$task_id]);
    $task = $stmt_task->fetch(PDO::FETCH_ASSOC);
    if (!$task) { header('Location: index.php'); exit; }

    // NEW: Fetch associated files
    $sql_files = "SELECT * FROM task_files WHERE task_id = ? ORDER BY uploaded_at DESC";
    $stmt_files = $pdo->prepare($sql_files);
    $stmt_files->execute([$task_id]);
    $files = $stmt_files->fetchAll(PDO::FETCH_ASSOC);

} catch (PDOException $e) { die("Error fetching data: " . $e->getMessage()); }

$status_map = ['not_started' => 'لم يبدأ بعد', 'in_progress' => 'قيد التنفيذ', 'completed' => 'مكتمل', 'late' => 'متأخر'];
$current_status_text = $status_map[$task['status']];
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مهمة: <?php echo htmlspecialchars($task['title']); ?></title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container task-details-page">
        <!-- (Header remains the same) -->
        <header class="task-details-header">
            <div class="breadcrumb">
                <a href="index.php">الرئيسية</a><span>/</span>
                <a href="group.php?id=<?php echo $task['group_id']; ?>" style="color: <?php echo htmlspecialchars($task['group_color']); ?>;"><?php echo htmlspecialchars($task['group_name']); ?></a>
            </div>
            <button class="theme-switcher" id="theme-switcher" aria-label="تبديل الوضع">
                <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.41-1.41zM18.36 5.64c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41zm-12.73 12.73c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41z"/></svg>
                <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/></svg>
            </button>
        </header>

        <main class="task-card-full">
            <div class="task-card-header">
                <h1><?php echo htmlspecialchars($task['title']); ?></h1>
                <div class="task-header-actions">
                    <span class="status-badge status-<?php echo $task['status']; ?>"><?php echo $current_status_text; ?></span>
                    <button id="edit-task-btn" class="btn btn-secondary">تعديل</button>
                </div>
            </div>
            <div class="task-card-body">
                <p><?php echo nl2br(htmlspecialchars($task['description'])); ?></p>
            </div>

            <!-- NEW: Attachments Section -->
            <div class="attachments-section">
                <h3>المرفقات</h3>
                <ul class="attachments-list">
                    <?php if (empty($files)): ?>
                        <li class="no-attachments">لا توجد ملفات مرفقة.</li>
                    <?php else: ?>
                        <?php foreach ($files as $file): ?>
                            <li class="attachment-item">
                                <a href="<?php echo htmlspecialchars($file['file_path']); ?>" download="<?php echo htmlspecialchars($file['original_filename']); ?>" class="attachment-link">
                                    <?php echo htmlspecialchars($file['original_filename']); ?>
                                </a>
                                <a href="delete_file.php?id=<?php echo $file['id']; ?>&task_id=<?php echo $task_id; ?>" class="delete-file-btn" title="حذف الملف" onclick="return confirm('هل أنت متأكد من حذف هذا الملف؟');">
                                    &times;
                                </a>
                            </li>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </ul>
                <form action="upload_file.php" method="POST" enctype="multipart/form-data" class="upload-form">
                    <input type="hidden" name="task_id" value="<?php echo $task_id; ?>">
                    <div class="form-group">
                        <input type="file" name="task_file" id="task_file" required>
                        <button type="submit" class="btn">رفع ملف</button>
                    </div>
                </form>
            </div>
        </main>
    </div>
    <!-- NEW: Modal for Editing a Task -->
    <div id="edit-task-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <h2>تعديل المهمة</h2>
            <form id="edit-task-form" action="update_task.php" method="POST">
                <input type="hidden" name="task_id" value="<?php echo $task['id']; ?>">
                <div class="form-group">
                    <label for="edit-task-title">عنوان المهمة</label>
                    <input type="text" id="edit-task-title" name="title" value="<?php echo htmlspecialchars($task['title']); ?>" required>
                </div>
                <div class="form-group">
                    <label for="edit-task-description">الوصف</label>
                    <textarea id="edit-task-description" name="description" rows="8"><?php echo htmlspecialchars($task['description']); ?></textarea>
                </div>
                <button type="submit" class="btn">حفظ التعديلات</button>
            </form>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>