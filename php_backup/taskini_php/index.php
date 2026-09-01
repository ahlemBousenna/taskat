<?php
require_once 'db.php';
$today = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مدير المهام اليومية</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <div class="container">
        <header class="header">
            <h1>مهامي اليومية</h1>
            <div class="header-controls">
                <div class="date-selector">
                    <input type="date" id="date-picker" value="<?php echo $today; ?>" aria-label="اختر يوماً">
                </div>
                <button id="create-group-btn" class="btn">مجموعة جديدة +</button>
                <button class="theme-switcher" id="theme-switcher" aria-label="تبديل الوضع">
                    <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.41-1.41zM18.36 5.64c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41zm-12.73 12.73c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41z"/></svg>
                    <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/></svg>
                </button>
            </div>
        </header>

        <main>
            <div id="groups-grid">
                <!-- Group cards will be loaded here by script.js -->
            </div>
        </main>
    </div>

    <!-- Modal for creating a new group -->
    <div id="group-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <h2>مجموعة مهام جديدة</h2>
            <form id="create-group-form" action="create_group.php" method="POST">
                <div class="form-group">
                    <label for="group-name">اسم المجموعة</label>
                    <input type="text" id="group-name" name="name" required placeholder="مثال: مهام العمل">
                </div>
                <div class="form-group">
                    <label for="group-color">اختر لوناً للمجموعة</label>
                    <input type="color" id="group-color" name="color" value="#007bff">
                </div>
                <div class="form-group">
                    <label for="group-date">تاريخ المجموعة</label>
                    <input type="date" id="group-date" name="date" value="<?php echo $today; ?>" required>
                </div>
                <button type="submit" class="btn">إنشاء المجموعة</button>
            </form>
        </div>
    </div>

    <!-- NEW: Confirmation Modal for Deleting Groups -->
    <div id="confirm-modal" class="modal">
        <div class="modal-content">
            <h2>تأكيد الحذف</h2>
            <p id="confirm-modal-text">هل أنت متأكد من أنك تريد حذف هذه المجموعة؟ سيتم حذف جميع المهام بداخلها بشكل دائم.</p>
            <div class="modal-actions">
                <button id="confirm-delete-btn" class="btn btn-danger">نعم، احذف</button>
                <button id="cancel-delete-btn" class="btn btn-secondary">إلغاء</button>
            </div>
        </div>
    </div>


    <script src="script.js"></script>
</body>
</html>