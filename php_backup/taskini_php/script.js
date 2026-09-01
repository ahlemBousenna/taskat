// --- script.js (Full Version with Migration Logic) ---

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Universal Setup (Applies to all pages) ---
    const body = document.body;
    const themeSwitcher = document.getElementById('theme-switcher');

    const applyTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') body.classList.add('dark-mode');
        else body.classList.remove('dark-mode');
    };

    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }
    applyTheme();

    // --- 2. Main Page Logic (index.php) ---
    const groupsGrid = document.getElementById('groups-grid');
    const dateInput = document.getElementById('date-picker');

    if (groupsGrid && dateInput) {
        const fetchGroups = async (date) => {
            try {
                groupsGrid.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">جاري تحميل المجموعات...</p>';
                const response = await fetch(`get_groups.php?date=${date}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const groups = await response.json();
                groupsGrid.innerHTML = '';
                if (groups.length === 0) {
                    groupsGrid.innerHTML = '<div class="no-groups"><h3>لا توجد مجموعات مهام لهذا اليوم.</h3><p>لم لا تنشئ واحدة باستخدام الزر أعلاه؟</p></div>';
                } else {
                    groups.forEach(group => {
                        const cardLink = document.createElement('a');
                        cardLink.href = `group.php?id=${group.id}`;
                        cardLink.className = 'group-card';
                        cardLink.style.borderLeftColor = group.color;
                        cardLink.dataset.groupId = group.id;
                        cardLink.innerHTML = `
                            <div class="card-header">
                                <h3>${escapeHTML(group.name)}</h3>
                                <button class="delete-group-btn" data-group-id="${group.id}" title="حذف المجموعة">
                                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                                </button>
                            </div>
                            <p class="task-count">${group.task_count} ${getTaskWord(group.task_count)}</p>`;
                        groupsGrid.appendChild(cardLink);
                    });
                }
            } catch (error) {
                console.error('Fetch error:', error);
                groupsGrid.innerHTML = '<div class="no-groups">حدث خطأ أثناء تحميل المجموعات. يرجى المحاولة مرة أخرى.</div>';
            }
        };

        dateInput.addEventListener('change', () => fetchGroups(dateInput.value));
        fetchGroups(dateInput.value);

        const groupModal = document.getElementById('group-modal');
        const createGroupBtn = document.getElementById('create-group-btn');
        if (createGroupBtn && groupModal) {
            const closeBtn = groupModal.querySelector('.close-btn');
            const modalDateInput = document.getElementById('group-date');
            createGroupBtn.addEventListener('click', () => {
                if (modalDateInput) modalDateInput.value = dateInput.value;
                groupModal.classList.add('active');
            });
            if (closeBtn) closeBtn.addEventListener('click', () => groupModal.classList.remove('active'));
            window.addEventListener('click', (event) => {
                if (event.target === groupModal) groupModal.classList.remove('active');
            });
        }

        const confirmModal = document.getElementById('confirm-modal');
        if (confirmModal) {
            const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
            const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
            let groupIdToDelete = null;

            groupsGrid.addEventListener('click', (event) => {
                const deleteButton = event.target.closest('.delete-group-btn');
                if (deleteButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    groupIdToDelete = deleteButton.dataset.groupId;
                    confirmModal.classList.add('active');
                }
            });

            const closeConfirmModal = () => {
                confirmModal.classList.remove('active');
                groupIdToDelete = null;
            };
            
            if(confirmDeleteBtn) {
                confirmDeleteBtn.addEventListener('click', async () => {
                    if (!groupIdToDelete) return;
                    try {
                        const response = await fetch('delete_group.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ groupId: groupIdToDelete })
                        });
                        const result = await response.json();
                        if (result.success) {
                            const cardToRemove = document.querySelector(`.group-card[data-group-id='${groupIdToDelete}']`);
                            if (cardToRemove) cardToRemove.remove();
                            if (groupsGrid.children.length === 0) {
                                groupsGrid.innerHTML = '<div class="no-groups"><h3>لا توجد مجموعات مهام لهذا اليوم.</h3><p>لم لا تنشئ واحدة باستخدام الزر أعلاه؟</p></div>';
                            }
                        } else {
                            alert('فشل حذف المجموعة: ' + result.message);
                        }
                    } catch (error) {
                        console.error('Error deleting group:', error);
                        alert('حدث خطأ في الشبكة.');
                    } finally {
                        closeConfirmModal();
                    }
                });
            }
            if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmModal);
            window.addEventListener('click', (event) => {
                if (event.target === confirmModal) closeConfirmModal();
            });
        }
    }

    // --- 3. Group Page Logic (group.php) ---
    const tasksList = document.querySelector('.tasks-list');
    if (tasksList) {
        const addTaskBtn = document.getElementById('add-task-btn');
        const taskModal = document.getElementById('task-modal');
        if (addTaskBtn && taskModal) {
            const closeBtn = taskModal.querySelector('.close-btn');
            addTaskBtn.addEventListener('click', () => taskModal.classList.add('active'));
            if (closeBtn) closeBtn.addEventListener('click', () => taskModal.classList.remove('active'));
            window.addEventListener('click', (event) => {
                if (event.target === taskModal) taskModal.classList.remove('active');
            });
        }

        tasksList.addEventListener('change', async (event) => {
            if (event.target.classList.contains('status-select')) {
                const selectElement = event.target;
                const taskId = selectElement.dataset.taskId;
                const newStatus = selectElement.value;
                const taskItem = selectElement.closest('.task-item');

                try {
                    const response = await fetch('update_task_status.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId, newStatus }),
                    });
                    const result = await response.json();
                    if (result.success) {
                        taskItem.className = 'task-item';
                        taskItem.classList.add(`status-${newStatus}`);
                        selectElement.className = 'status-select status-badge';
                        selectElement.classList.add(`status-${newStatus}`);
                    } else {
                        console.error('Failed to update status:', result.message);
                        const oldStatus = Array.from(taskItem.classList).find(c => c.startsWith('status-')).replace('status-', '');
                        selectElement.value = oldStatus;
                    }
                } catch (error) {
                    console.error('Error sending update request:', error);
                }
            }
        });

        const migrateBtn = document.getElementById('migrate-tasks-btn');
        if (migrateBtn) {
            migrateBtn.addEventListener('click', async () => {
                const groupId = migrateBtn.dataset.groupId;
                if (!confirm('هل أنت متأكد من ترحيل جميع المهام غير المكتملة إلى اليوم التالي؟')) {
                    return;
                }
                try {
                    const response = await fetch('migrate_tasks.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ groupId: groupId })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        location.reload();
                    }
                } catch (error) {
                    console.error('Migration error:', error);
                    alert('حدث خطأ أثناء محاولة ترحيل المهام.');
                }
            });
        }
    }
    
    // --- 4. Task Details Page Logic (task.php) ---
    const taskDetailsPage = document.querySelector('.task-details-page');
    if (taskDetailsPage) {
        const editTaskBtn = document.getElementById('edit-task-btn');
        const editTaskModal = document.getElementById('edit-task-modal');

        if (editTaskBtn && editTaskModal) {
            const closeBtn = editTaskModal.querySelector('.close-btn');
            
            editTaskBtn.addEventListener('click', () => {
                editTaskModal.classList.add('active');
            });

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    editTaskModal.classList.remove('active');
                });
            }

            window.addEventListener('click', (event) => {
                if (event.target === editTaskModal) {
                    editTaskModal.classList.remove('active');
                }
            });
        }
    }
});

// --- Helper Functions ---
function escapeHTML(str) { if (typeof str !== 'string') return ''; return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag)); }
function getTaskWord(count) { if (count === 1) return 'مهمة'; if (count === 2) return 'مهمتان'; if (count >= 3 && count <= 10) return 'مهام'; return 'مهمة'; }
