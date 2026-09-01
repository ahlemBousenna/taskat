<?php
// --- db.php ---

// (Connection logic remains the same)
$servername = "localhost";
$username = "root";
$password = "root";
$dbname = "daily_tasks_app";
$charset = "utf8mb4";

try {
    $dsn = "mysql:host=$servername;charset=$charset";
    $pdo = new PDO($dsn, $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    $pdo->exec("USE `$dbname`;");
    
    // Create tables if they don't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS `task_groups` (`id` INT AUTO_INCREMENT PRIMARY KEY, `name` VARCHAR(255) NOT NULL, `color` VARCHAR(7) NOT NULL DEFAULT '#FFFFFF', `date` DATE NOT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `tasks` (`id` INT AUTO_INCREMENT PRIMARY KEY, `group_id` INT NOT NULL, `title` VARCHAR(255) NOT NULL, `description` TEXT, `status` ENUM('not_started', 'in_progress', 'completed', 'late') NOT NULL DEFAULT 'not_started', `migrated_from_date` DATE NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // NEW: Create the task_files table
    $sql_task_files = "
    CREATE TABLE IF NOT EXISTS `task_files` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `task_id` INT NOT NULL,
        `original_filename` VARCHAR(255) NOT NULL,
        `stored_filename` VARCHAR(255) NOT NULL,
        `file_path` VARCHAR(255) NOT NULL,
        `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";
    $pdo->exec($sql_task_files);

    // Add migrated_from_date column if it doesn't exist (for backward compatibility)
    $pdo->exec("ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `migrated_from_date` DATE NULL DEFAULT NULL AFTER `status`;");

} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

// (Helper functions remain the same)
function formatAlgerianDate($dateString) {
    if(!$dateString) return '';
    setlocale(LC_TIME, 'ar_DZ.UTF-8', 'ar_DZ', 'ar');
    $timestamp = strtotime($dateString);
    $days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    $months = [1 => 'جانفي', 2 => 'فيفري', 3 => 'مارس', 4 => 'أفريل', 5 => 'ماي', 6 => 'جوان', 7 => 'جويلية', 8 => 'أوت', 9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'];
    $dayOfWeek = $days[date('w', $timestamp)];
    $dayOfMonth = date('d', $timestamp);
    $month = $months[(int)date('n', $timestamp)];
    $year = date('Y', $timestamp);
    return $dayOfWeek . " " . $dayOfMonth . " " . $month . " " . $year;
}

function truncateDescription($text, $limit = 15) {
    if (empty($text)) return '';
    $words = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
    if (count($words) > $limit) {
        return implode(' ', array_slice($words, 0, $limit)) . '...';
    }
    return $text;
}
?>