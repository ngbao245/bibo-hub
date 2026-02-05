// Tasks Management - Microsoft To Do style with Custom Lists (localStorage)
// API Configuration
const API_TASKS = API_CONFIG.TASKS;

// Utility: Debounce function for smooth search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// State
let tasks = [];
let customLists = []; // Stored in localStorage
let currentTaskList = 'today'; // all, today, important, completed, or custom list name
let taskSearchQuery = '';

// Task Management Functions
async function loadTasks() {
    console.log('Loading tasks...');
    try {
        const response = await fetch(API_TASKS);
        const allRecords = await response.json();
        console.log('All records from API:', allRecords);
        
        // Separate lists and tasks
        customLists = allRecords.filter(record => record.type === 'list');
        tasks = allRecords.filter(record => record.type === 'task' || !record.type);
        
        console.log('Custom lists:', customLists);
        console.log('Tasks:', tasks);
        
        tasks.sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (a.priority !== 'high' && b.priority === 'high') return 1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        renderCustomLists();
        renderTasksList();
    } catch (error) {
        console.error('Error loading tasks:', error);
        const tasksList = document.getElementById('tasksList');
        if (tasksList) {
            tasksList.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading tasks</div>';
        }
    }
}

function loadCustomLists() {
    // Lists are now loaded together with tasks in loadTasks()
    renderCustomLists();
}

async function saveTask(taskData) {
    try {
        if (taskData.id && taskData.id !== 'new') {
            // Update existing task - preserve original parentId and other fields
            const originalTask = tasks.find(t => t.id === taskData.id);
            const updatedTask = { 
                ...originalTask, // Preserve all original fields first
                ...taskData,     // Then override with new data
                type: 'task',
                status: taskData.completed ? 'completed' : 'pending',
                priority: taskData.important ? 'high' : 'normal',
                completedDate: taskData.completed ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
                // Explicitly preserve parentId from original task
                parentId: originalTask ? originalTask.parentId : null
            };
            const index = tasks.findIndex(t => t.id === taskData.id);
            if (index !== -1) {
                tasks[index] = updatedTask;
                console.log('Updated task in array:', updatedTask);
                console.log('Preserved parentId:', updatedTask.parentId);
            }
            
            // Update API in background
            fetch(`${API_TASKS}/${taskData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTask)
            }).catch(error => {
                console.error('Error saving task to API:', error);
            });
        } else {
            // Create new task
            const newTaskData = { 
                ...taskData, 
                id: 'temp_' + Date.now(),
                type: 'task',
                status: 'pending',
                priority: taskData.important ? 'high' : 'normal',
                parentId: isCustomList(currentTaskList) ? getListId(currentTaskList) : null,
                createdAt: new Date().toISOString(), 
                updatedAt: new Date().toISOString() 
            };
            tasks.unshift(newTaskData);
            console.log('Added new task to array:', newTaskData);
            
            // Create in API and update with real ID
            const response = await fetch(API_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...taskData, 
                    type: 'task',
                    status: 'pending',
                    priority: taskData.important ? 'high' : 'normal',
                    parentId: newTaskData.parentId, 
                    createdAt: newTaskData.createdAt, 
                    updatedAt: newTaskData.updatedAt 
                })
            });
            const newTask = await response.json();
            
            const index = tasks.findIndex(t => t.id === newTaskData.id);
            if (index !== -1) {
                tasks[index] = newTask;
                console.log('Updated task with real ID:', newTask);
            }
        }
        
        // Always re-render and update counts after save
        console.log('Re-rendering tasks after save, total tasks:', tasks.length);
        renderTasksList();
        updateTaskCounts();
        
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Error saving task');
    }
}

async function saveList(listName) {
    try {
        if (!listName || customLists.find(l => l.title === listName)) return;
        
        const newListData = {
            id: 'temp_list_' + Date.now(),
            type: 'list',
            title: listName,
            name: listName, // For compatibility with schema
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        customLists.push(newListData);
        renderCustomLists();
        
        const response = await fetch(API_TASKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newListData)
        });
        const newList = await response.json();
        
        const index = customLists.findIndex(l => l.id === newListData.id);
        if (index !== -1) customLists[index] = newList;
        renderCustomLists();
    } catch (error) {
        console.error('Error saving list:', error);
        alert('Error saving list');
    }
}

async function deleteList(listId) {
    const list = customLists.find(l => l.id === listId);
    if (!list) return;
    
    if (!confirm(`Delete "${list.title}" list? All tasks in this list will be moved to "All Tasks".`)) return;
    
    try {
        // Move tasks from this list to no list (parentId = null)
        tasks.forEach(task => {
            if (task.parentId === listId) {
                task.parentId = null;
                fetch(`${API_TASKS}/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                }).catch(error => {
                    console.error('Error updating task:', error);
                });
            }
        });
        
        // Remove list
        customLists = customLists.filter(l => l.id !== listId);
        renderCustomLists();
        
        // If currently viewing this list, switch to All Tasks
        if (currentTaskList === listId) {
            switchTaskList('all');
        }
        
        renderTasksList();
        
        // Delete from API
        fetch(`${API_TASKS}/${listId}`, { method: 'DELETE' }).catch(error => {
            console.error('Error deleting list from API:', error);
        });
    } catch (error) {
        console.error('Error deleting list:', error);
        alert('Error deleting list');
    }
}

async function toggleTaskComplete(id) {
    try {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        task.completedDate = task.status === 'completed' ? new Date().toISOString() : null;
        task.updatedAt = new Date().toISOString();
        
        console.log('Toggled task completion:', task);
        
        // Update UI and counts immediately
        renderTasksList();
        updateTaskCounts();
        
        fetch(`${API_TASKS}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        }).catch(error => {
            console.error('Error updating task:', error);
        });
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

async function toggleTaskImportant(id) {
    try {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        
        task.priority = task.priority === 'high' ? 'normal' : 'high';
        task.updatedAt = new Date().toISOString();
        
        console.log('Toggled task importance:', task);
        
        // Update UI and counts immediately
        renderTasksList();
        updateTaskCounts();
        
        fetch(`${API_TASKS}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        }).catch(error => {
            console.error('Error updating task:', error);
        });
    } catch (error) {
        console.error('Error toggling importance:', error);
    }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    
    try {
        // Optimistic UI - remove immediately
        tasks = tasks.filter(t => t.id !== id);
        
        console.log('Deleted task from array, remaining tasks:', tasks.length);
        
        // Update UI and counts immediately
        renderTasksList();
        updateTaskCounts();
        
        fetch(`${API_TASKS}/${id}`, { method: 'DELETE' }).catch(error => {
            console.error('Error deleting from API:', error);
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task');
    }
}

// Render Functions
function renderCustomLists() {
    const customListsContainer = document.getElementById('customLists');
    if (!customListsContainer) return;
    
    if (customLists.length === 0) {
        customListsContainer.innerHTML = '';
        return;
    }
    
    customListsContainer.innerHTML = customLists.map(list => `
        <div class="task-list-item ${currentTaskList === list.id ? 'active' : ''}" 
             data-list="${list.id}" 
             onclick="switchTaskList('${list.id}')"
             oncontextmenu="showListContextMenu(event, '${list.id}')">
            <div class="list-name">${escapeHtml(list.title || list.name)}</div>
            <div class="list-count">${getTaskCountForList(list.id)}</div>
        </div>
    `).join('');
}

function renderTasksList() {
    const filteredTasks = getFilteredTasks();
    const tasksList = document.getElementById('tasksList');
    
    if (!tasksList) {
        console.error('tasksList element not found in DOM');
        return;
    }
    
    console.log('Rendering tasks:', { 
        totalTasks: tasks.length, 
        filteredTasks: filteredTasks.length, 
        currentList: currentTaskList,
        searchQuery: taskSearchQuery
    });
    
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No tasks found</div>';
        return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => `
        <div class="task-item ${task.status === 'completed' ? 'completed' : ''}" data-task-id="${task.id}">
            <div class="task-checkbox">
                <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                       data-task-id="${task.id}"
                       class="task-check">
            </div>
            <div class="task-content" data-task-id="${task.id}">
                <div class="task-title ${task.status === 'completed' ? 'strikethrough' : ''}">${escapeHtml(task.title || 'Untitled')}</div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    ${task.priority === 'high' ? `<span class="task-recurring">Important</span>` : ''}
                    ${task.dueDate ? `<span class="task-due ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : ''}">${formatTaskDate(task.dueDate)}</span>` : ''}
                    ${task.status ? `<span class="task-category">${escapeHtml(task.status)}</span>` : ''}
                    ${hasAnyTaskUrl(task) ? `<span class="task-urls">${getTaskUrlCount(task)} URLs</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-icon task-important ${task.priority === 'high' ? 'active' : ''}" 
                        data-task-id="${task.id}" data-action="important"
                        title="${task.priority === 'high' ? 'Remove from important' : 'Mark as important'}">!</button>
                <button class="btn-icon task-delete" 
                        data-task-id="${task.id}" data-action="delete"
                        title="Delete task">×</button>
            </div>
        </div>
    `).join('');
    
    // Always update counts and setup event listeners after rendering
    updateTaskCounts();
    setupTaskEventListeners();
}

function getFilteredTasks() {
    let filtered = tasks;
    
    // Apply search filter
    if (taskSearchQuery) {
        filtered = filtered.filter(task => 
            task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
            (task.description && task.description.toLowerCase().includes(taskSearchQuery.toLowerCase()))
        );
    }
    
    // Apply list filter
    switch (currentTaskList) {
        case 'today':
            const today = new Date().toDateString();
            filtered = filtered.filter(task => 
                task.status !== 'completed' && (
                    task.recurring === true || // Daily recurring tasks always show
                    (task.dueDate && new Date(task.dueDate).toDateString() === today) ||
                    isOverdue(task.dueDate)
                )
            );
            break;
        case 'important':
            filtered = filtered.filter(task => task.priority === 'high' && task.status !== 'completed');
            break;
        case 'completed':
            filtered = filtered.filter(task => task.status === 'completed');
            break;
        case 'all':
            // Show all tasks
            break;
        default:
            // Custom list
            if (isCustomList(currentTaskList)) {
                console.log('Filtering for custom list:', currentTaskList);
                console.log('All tasks:', tasks.map(t => ({ id: t.id, title: t.title, parentId: t.parentId })));
                filtered = filtered.filter(task => {
                    const matches = task.parentId === currentTaskList;
                    console.log(`Task "${task.title}" (parentId: ${task.parentId}) matches list ${currentTaskList}:`, matches);
                    return matches;
                });
                console.log('Filtered tasks for custom list:', filtered.map(t => ({ id: t.id, title: t.title, parentId: t.parentId })));
            }
            break;
    }
    
    return filtered;
}

function updateTaskCounts() {
    const allCount = tasks.length;
    const todayCount = tasks.filter(task => 
        task.status !== 'completed' && (
            (task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()) ||
            isOverdue(task.dueDate)
        )
    ).length;
    const importantCount = tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length;
    const completedCount = tasks.filter(task => task.status === 'completed').length;
    
    // Update sidebar counts
    const allCountEl = document.querySelector('[data-list="all"] .list-count');
    const todayCountEl = document.querySelector('[data-list="today"] .list-count');
    const importantCountEl = document.querySelector('[data-list="important"] .list-count');
    const completedCountEl = document.querySelector('[data-list="completed"] .list-count');
    
    if (allCountEl) allCountEl.textContent = allCount;
    if (todayCountEl) todayCountEl.textContent = todayCount;
    if (importantCountEl) importantCountEl.textContent = importantCount;
    if (completedCountEl) completedCountEl.textContent = completedCount;
    
    // Update custom list counts
    customLists.forEach(list => {
        const listCountEl = document.querySelector(`[data-list="${list.id}"] .list-count`);
        if (listCountEl) {
            listCountEl.textContent = getTaskCountForList(list.id);
        }
    });
}

// Task Actions
async function createNewTask() {
    // Tạo task "Untitled" nhưng chưa hiển thị trong danh sách
    const newTaskData = {
        title: 'Untitled',
        description: '',
        dueDate: null,
        category: '',
        important: false,
        recurring: false,
        url1: '',
        url2: '',
        url3: '',
        parentId: isCustomList(currentTaskList) ? getListId(currentTaskList) : null
    };
    
    console.log('Creating new untitled task:', newTaskData);
    
    try {
        // Tạo task thật trên API trước
        const response = await fetch(API_TASKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...newTaskData, 
                type: 'task',
                status: 'pending',
                priority: 'normal',
                createdAt: new Date().toISOString(), 
                updatedAt: new Date().toISOString() 
            })
        });
        const savedTask = await response.json();
        
        console.log('Task created on API:', savedTask);
        
        // Thêm vào array local
        tasks.unshift(savedTask);
        console.log('Added task to local array:', savedTask);
        
        // Mở editor ngay lập tức (task sẽ hiện trong danh sách khi editor mở)
        showTaskEditor(savedTask);
        
        // Focus vào title input để user có thể sửa tên ngay
        setTimeout(() => {
            const titleInput = document.getElementById('taskTitle');
            if (titleInput) {
                titleInput.select(); // Select all text để user có thể ghi đè
            }
        }, 100);
        
    } catch (error) {
        console.error('Error creating new task:', error);
        alert('Error creating task');
    }
}

function createNewList() {
    // Generate unique name
    let baseName = 'Untitled list';
    let counter = 0;
    let listName = baseName;
    
    while (customLists.find(l => (l.title || l.name) === listName)) {
        counter++;
        listName = `${baseName} (${counter})`;
    }
    
    // Create list with editing state
    const tempId = 'temp_list_' + Date.now();
    const newList = {
        id: tempId,
        type: 'list',
        title: listName,
        name: listName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEditing: true
    };
    
    customLists.push(newList);
    renderCustomLists();
    
    // Start editing immediately
    setTimeout(() => {
        startEditingList(tempId, listName);
    }, 50);
}

function startEditingList(listId, currentName) {
    const listElement = document.querySelector(`[data-list="${listId}"]`);
    if (!listElement) return;
    
    const nameElement = listElement.querySelector('.list-name');
    if (!nameElement) return;
    
    listElement.classList.add('list-item-editing');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'list-name-input';
    input.value = currentName;
    
    const saveEdit = async () => {
        const newName = input.value.trim();
        if (newName) {
            // Update list name
            const list = customLists.find(l => l.id === listId);
            if (list) {
                list.title = newName;
                list.name = newName;
                list.updatedAt = new Date().toISOString();
                delete list.isEditing;
                
                // Save to API
                if (listId.startsWith('temp_')) {
                    // Create new list
                    try {
                        const response = await fetch(API_TASKS, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'list',
                                title: newName,
                                name: newName,
                                createdAt: list.createdAt,
                                updatedAt: list.updatedAt
                            })
                        });
                        const savedList = await response.json();
                        
                        // Replace temp list with real list
                        const index = customLists.findIndex(l => l.id === listId);
                        if (index !== -1) customLists[index] = savedList;
                        
                        console.log('New list saved:', savedList);
                    } catch (error) {
                        console.error('Error saving list:', error);
                    }
                } else {
                    // Update existing list
                    fetch(`${API_TASKS}/${listId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(list)
                    }).catch(error => {
                        console.error('Error updating list:', error);
                    });
                }
            }
        } else {
            // Keep default name if empty
            const list = customLists.find(l => l.id === listId);
            if (list && listId.startsWith('temp_')) {
                // Save with default name
                try {
                    const response = await fetch(API_TASKS, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'list',
                            title: currentName,
                            name: currentName,
                            createdAt: list.createdAt,
                            updatedAt: list.updatedAt
                        })
                    });
                    const savedList = await response.json();
                    
                    // Replace temp list with real list
                    const index = customLists.findIndex(l => l.id === listId);
                    if (index !== -1) customLists[index] = savedList;
                    
                    console.log('New list saved with default name:', savedList);
                } catch (error) {
                    console.error('Error saving list:', error);
                }
            }
        }
        
        renderCustomLists();
    };
    
    const cancelEdit = () => {
        if (listId.startsWith('temp_')) {
            // Remove temp list if cancelled
            customLists = customLists.filter(l => l.id !== listId);
        }
        renderCustomLists();
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    nameElement.replaceWith(input);
    input.focus();
    input.select();
}

function showListContextMenu(event, listId) {
    event.preventDefault();
    event.stopPropagation();
    
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const list = customLists.find(l => l.id === listId);
    if (!list) return;
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" onclick="renameList('${listId}')">Rename</div>
        <div class="context-menu-item danger" onclick="deleteList('${listId}')">Delete</div>
    `;
    
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

function renameList(listId) {
    const list = customLists.find(l => l.id === listId);
    if (list) {
        startEditingList(listId, list.title || list.name);
    }
    
    // Remove context menu
    const menu = document.querySelector('.context-menu');
    if (menu) menu.remove();
}

function newTask() {
    createNewTask();
}

function newList() {
    createNewList();
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        showTaskEditor(task);
    }
}

function showTaskEditor(task = null) {
    const isEdit = task !== null;
    const taskData = task || { title: '', description: '', dueDate: '', category: '', important: false, recurring: false, url1: '', url2: '', url3: '' };
    
    // Debug info
    if (isEdit) {
        console.log('Editing task:', taskData);
        console.log('Task parentId:', taskData.parentId);
        console.log('Current list:', currentTaskList);
    }
    
    // Refresh task list when editor opens to ensure data is up to date
    console.log('Refreshing task list before opening editor...');
    renderTasksList();
    updateTaskCounts();
    
    // Show task editor in right panel
    const taskDetailsPanel = document.getElementById('taskDetailsPanel');
    if (!taskDetailsPanel) return;
    
    // Get list name for display
    let listName = 'All Tasks';
    if (isEdit && taskData.parentId) {
        const parentList = customLists.find(l => l.id === taskData.parentId);
        if (parentList) {
            listName = parentList.title || parentList.name;
        }
    } else if (isCustomList(currentTaskList)) {
        const currentList = customLists.find(l => l.id === currentTaskList);
        if (currentList) {
            listName = currentList.title || currentList.name;
        }
    }
    
    taskDetailsPanel.style.display = 'flex';
    taskDetailsPanel.innerHTML = `
        <div class="task-editor">
            <div class="editor-header">
                <div class="editor-title">${isEdit ? 'Edit Task' : 'New Task'}</div>
                <div class="editor-actions">
                    <button class="btn-close" onclick="cancelTaskEdit()" title="Close">×</button>
                </div>
            </div>
            <div class="editor-content">
                ${isEdit ? `<div class="task-list-info" onclick="toggleCurrentListDropdown()">
                    <div class="current-list-dropdown">
                        <div class="current-list-btn">
                            <span></span><strong id="currentListName">${escapeHtml(listName)}</strong>
                        </div>
                        <div class="current-list-options" id="currentListOptions">
                            <div class="current-list-option" onclick="moveTaskToList('')">
                                <span class="option-text">All Tasks</span>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
                <form id="taskForm">
                    <div class="form-group">
                        <input type="text" id="taskTitle" value="${escapeHtml(taskData.title)}" placeholder="What do you need to do?" class="task-title-input" required>
                    </div>

                    <div class="form-group">
                        <textarea id="taskDescription" placeholder="Add details..." class="task-description-input">${escapeHtml(taskData.description || '')}</textarea>
                    </div>

                    <div class="form-section">
                        <div class="form-item">
                            <div class="form-item-content">
                                <label>Due Date</label>
                                <div class="due-date-dropdown">
                                    <button type="button" class="due-date-btn" id="dueDateBtn" onclick="toggleDueDateDropdown()">
                                        <span id="dueDateText">Pick a date</span>
                                    </button>
                                    <div class="due-date-options" id="dueDateOptions">
                                        <div class="due-date-option" onclick="setDueDate('today')">
                                            <span class="option-text">Today</span>
                                            <span class="option-date" id="todayDate"></span>
                                        </div>
                                        <div class="due-date-option" onclick="setDueDate('tomorrow')">
                                            <span class="option-text">Tomorrow</span>
                                            <span class="option-date" id="tomorrowDate"></span>
                                        </div>
                                        <div class="due-date-option" onclick="setDueDate('custom')">
                                            <span class="option-text">Pick a date</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- Hidden date input for custom date -->
                                <input type="date" id="taskDueDate" value="${taskData.dueDate ? taskData.dueDate.split('T')[0] : ''}" style="display: none;">
                            </div>
                        </div>

                        <div class="form-item">
                            <div class="form-item-content">
                                <label>Category</label>
                                <input type="text" id="taskCategory" value="${escapeHtml(taskData.category || '')}" placeholder="Work, Personal, etc.">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Options</h4>
                        <div class="toggle-buttons">
                            <button type="button" class="toggle-btn" id="taskImportantBtn" onclick="toggleImportantButton()">
                                <span class="toggle-title">Mark as important</span>
                                <span class="toggle-subtitle">High priority task</span>
                            </button>

                            <button type="button" class="toggle-btn" id="taskRecurringBtn" onclick="toggleRecurringButton()">
                                <span class="toggle-title">Daily recurring task</span>
                                <span class="toggle-subtitle">Repeats every day</span>
                            </button>
                        </div>
                        
                        <!-- Hidden checkboxes for form data -->
                        <input type="checkbox" id="taskImportant" ${taskData.priority === 'high' ? 'checked' : ''} style="display: none;">
                        <input type="checkbox" id="taskRecurring" ${taskData.recurring ? 'checked' : ''} style="display: none;">
                    </div>

                    <div class="form-section">
                        <h4>Resources</h4>
                        <div class="form-item">
                            <div class="form-item-content">
                                <label>URL 1</label>
                                <input type="url" id="taskUrl1" value="${escapeHtml(taskData.url1 || '')}" placeholder="https://...">
                            </div>
                        </div>

                        <div class="form-item">
                            <div class="form-item-content">
                                <label>URL 2</label>
                                <input type="url" id="taskUrl2" value="${escapeHtml(taskData.url2 || '')}" placeholder="https://...">
                            </div>
                        </div>

                        <div class="form-item">
                            <div class="form-item-content">
                                <label>URL 3</label>
                                <input type="url" id="taskUrl3" value="${escapeHtml(taskData.url3 || '')}" placeholder="https://...">
                            </div>
                        </div>
                    </div>


                </form>
            </div>
        </div>
    `;
    
    window.currentEditingTask = task;
    document.getElementById('taskTitle').focus();
    
    // Initialize toggle buttons
    initializeToggleButtons(taskData);
    
    // Setup auto-save event listeners
    setupAutoSave();
}

function showTaskDetails(task) {
    const editorView = document.getElementById('editorView');
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${escapeHtml(task.title)}</div>
            <div class="editor-actions">
                <button class="btn" onclick="editTask('${task.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteTask('${task.id}')">Delete</button>
            </div>
        </div>
        <div class="view-mode">
            <div class="meta-info">
                ${task.completed ? '<span class="meta-badge completed-badge">Completed</span>' : '<span class="meta-badge pending-badge">Pending</span>'}
                ${task.important ? '<span class="meta-badge important-badge">Important</span>' : ''}
                ${task.recurring ? '<span class="meta-badge recurring-badge">Daily Recurring</span>' : ''}
                ${task.category ? `<span class="meta-badge">${escapeHtml(task.category)}</span>` : ''}
                ${task.dueDate ? `<span class="meta-badge ${isOverdue(task.dueDate) && !task.completed ? 'overdue-badge' : 'due-badge'}">${formatTaskDate(task.dueDate)}</span>` : ''}
            </div>
            
            ${task.description ? `
                <div class="content-section">
                    <h3>Description</h3>
                    <div class="content-text">${escapeHtml(task.description)}</div>
                </div>
            ` : ''}
            
            ${hasAnyTaskUrl(task) ? `
                <div class="content-section">
                    <h3>Resources</h3>
                    <div class="urls-list">
                        ${task.url1 ? `<div class="url-group"><label>URL 1:</label><br><a href="${escapeHtml(task.url1)}" target="_blank" class="url-link">${escapeHtml(task.url1)}</a></div>` : ''}
                        ${task.url2 ? `<div class="url-group"><label>URL 2:</label><br><a href="${escapeHtml(task.url2)}" target="_blank" class="url-link">${escapeHtml(task.url2)}</a></div>` : ''}
                        ${task.url3 ? `<div class="url-group"><label>URL 3:</label><br><a href="${escapeHtml(task.url3)}" target="_blank" class="url-link">${escapeHtml(task.url3)}</a></div>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}


// Auto-save functionality
function setupAutoSave() {
    // Auto-save on blur for text inputs
    const titleInput = document.getElementById('taskTitle');
    const descriptionInput = document.getElementById('taskDescription');
    const categoryInput = document.getElementById('taskCategory');
    const url1Input = document.getElementById('taskUrl1');
    const url2Input = document.getElementById('taskUrl2');
    const url3Input = document.getElementById('taskUrl3');
    
    const inputs = [titleInput, descriptionInput, categoryInput, url1Input, url2Input, url3Input];
    
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('blur', autoSaveTask);
        }
    });
    
    // Auto-save on change for date input (hidden)
    const dueDateInput = document.getElementById('taskDueDate');
    if (dueDateInput) {
        dueDateInput.addEventListener('change', autoSaveTask);
    }
}

function autoSaveTask() {
    if (!window.currentEditingTask) return;
    
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return; // Don't save if no title
    
    const taskData = {
        id: window.currentEditingTask.id,
        title: title,
        description: document.getElementById('taskDescription').value.trim(),
        dueDate: document.getElementById('taskDueDate').value || null,
        category: document.getElementById('taskCategory').value.trim(),
        important: document.getElementById('taskImportant').checked,
        recurring: document.getElementById('taskRecurring').checked,
        url1: document.getElementById('taskUrl1').value.trim(),
        url2: document.getElementById('taskUrl2').value.trim(),
        url3: document.getElementById('taskUrl3').value.trim(),
        parentId: window.currentEditingTask.parentId
    };
    
    console.log('Auto-saving task:', taskData);
    
    saveTask(taskData).then(() => {
        // Refresh task list after auto-save to show updated data
        console.log('Refreshing task list after auto-save...');
        renderTasksList();
        updateTaskCounts();
    }).catch(error => {
        console.error('Error auto-saving task:', error);
    });
}

// Toggle button functions
function toggleImportantButton() {
    const btn = document.getElementById('taskImportantBtn');
    const checkbox = document.getElementById('taskImportant');
    
    checkbox.checked = !checkbox.checked;
    updateToggleButtonState(btn, checkbox.checked);
    
    // Auto-save after toggle
    autoSaveTask();
}

function toggleRecurringButton() {
    const btn = document.getElementById('taskRecurringBtn');
    const checkbox = document.getElementById('taskRecurring');
    
    checkbox.checked = !checkbox.checked;
    updateToggleButtonState(btn, checkbox.checked);
    
    // Auto-save after toggle
    autoSaveTask();
}

function updateToggleButtonState(button, isActive) {
    if (isActive) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}

// Initialize toggle buttons when editor opens
function initializeToggleButtons(taskData) {
    setTimeout(() => {
        const importantBtn = document.getElementById('taskImportantBtn');
        const recurringBtn = document.getElementById('taskRecurringBtn');
        
        if (importantBtn) {
            updateToggleButtonState(importantBtn, taskData.priority === 'high');
        }
        if (recurringBtn) {
            updateToggleButtonState(recurringBtn, taskData.recurring);
        }
        
        // Initialize due date dropdown
        initializeDueDateDropdown(taskData.dueDate);
        
        // Initialize current list dropdown
        initializeCurrentListDropdown(taskData.parentId);
    }, 50);
}

// Current List Dropdown Functions
function initializeCurrentListDropdown(currentParentId) {
    const listOptions = document.getElementById('currentListOptions');
    if (!listOptions) return;
    
    // Clear existing options
    listOptions.innerHTML = '';
    
    // Add "All Tasks" option
    const allTasksOption = document.createElement('div');
    allTasksOption.className = 'current-list-option';
    allTasksOption.onclick = () => moveTaskToList('');
    allTasksOption.innerHTML = '<span class="option-text">All Tasks</span>';
    listOptions.appendChild(allTasksOption);
    
    // Add custom lists
    customLists.forEach(list => {
        const option = document.createElement('div');
        option.className = 'current-list-option';
        option.onclick = () => moveTaskToList(list.id);
        option.innerHTML = `<span class="option-text">${escapeHtml(list.title || list.name)}</span>`;
        listOptions.appendChild(option);
    });
}

function toggleCurrentListDropdown() {
    const dropdown = document.getElementById('currentListOptions');
    if (!dropdown) return;
    
    const isVisible = dropdown.classList.contains('show');
    
    if (isVisible) {
        dropdown.classList.remove('show');
        setTimeout(() => {
            document.removeEventListener('click', closeCurrentListDropdown);
        }, 200);
    } else {
        dropdown.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeCurrentListDropdown);
        }, 10);
    }
}

function closeCurrentListDropdown(event) {
    const dropdown = document.getElementById('currentListOptions');
    const taskListInfo = document.querySelector('.task-list-info');
    
    if (!dropdown.contains(event.target) && !taskListInfo.contains(event.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeCurrentListDropdown);
    }
}

async function moveTaskToList(listId) {
    const currentListName = document.getElementById('currentListName');
    const dropdown = document.getElementById('currentListOptions');
    
    if (!window.currentEditingTask) return;
    
    // Update display
    if (listId) {
        const list = customLists.find(l => l.id === listId);
        if (list) {
            currentListName.textContent = list.title || list.name;
        }
    } else {
        currentListName.textContent = 'All Tasks';
    }
    
    // Update task's parentId
    const oldParentId = window.currentEditingTask.parentId;
    window.currentEditingTask.parentId = listId || null;
    
    // Close dropdown
    dropdown.classList.remove('show');
    document.removeEventListener('click', closeCurrentListDropdown);
    
    // Auto-save if parentId changed
    if (oldParentId !== (listId || null)) {
        try {
            // Get current form data
            const taskData = {
                id: window.currentEditingTask.id,
                title: document.getElementById('taskTitle').value.trim(),
                description: document.getElementById('taskDescription').value.trim(),
                dueDate: document.getElementById('taskDueDate').value || null,
                category: document.getElementById('taskCategory').value.trim(),
                important: document.getElementById('taskImportant').checked,
                recurring: document.getElementById('taskRecurring').checked,
                url1: document.getElementById('taskUrl1').value.trim(),
                url2: document.getElementById('taskUrl2').value.trim(),
                url3: document.getElementById('taskUrl3').value.trim(),
                parentId: listId || null
            };
            
            console.log('Auto-saving task after list change:', taskData);
            await saveTask(taskData);
            
            // Refresh task list to show updated data
            console.log('Refreshing task list after moving task to different list...');
            renderTasksList();
            updateTaskCounts();
            
        } catch (error) {
            console.error('Error auto-saving task:', error);
            // Revert on error
            window.currentEditingTask.parentId = oldParentId;
            if (oldParentId) {
                const oldList = customLists.find(l => l.id === oldParentId);
                currentListName.textContent = oldList ? oldList.title : 'All Tasks';
            } else {
                currentListName.textContent = 'All Tasks';
            }
        }
    }
}

// Due Date Dropdown Functions
function initializeDueDateDropdown(currentDate) {
    // Set date labels
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('todayDate').textContent = formatDateShort(today);
    document.getElementById('tomorrowDate').textContent = formatDateShort(tomorrow);
    
    // Set current selection
    if (currentDate) {
        const date = new Date(currentDate);
        const todayStr = today.toDateString();
        const tomorrowStr = tomorrow.toDateString();
        const dateStr = date.toDateString();
        
        if (dateStr === todayStr) {
            document.getElementById('dueDateText').textContent = 'Today';
        } else if (dateStr === tomorrowStr) {
            document.getElementById('dueDateText').textContent = 'Tomorrow';
        } else {
            document.getElementById('dueDateText').textContent = formatDateShort(date);
        }
    } else {
        document.getElementById('dueDateText').textContent = 'Pick a date';
    }
}

function toggleDueDateDropdown() {
    const dropdown = document.getElementById('dueDateOptions');
    const isVisible = dropdown.classList.contains('show');
    
    if (isVisible) {
        dropdown.classList.remove('show');
        // Remove click listener after animation
        setTimeout(() => {
            document.removeEventListener('click', closeDueDateDropdown);
        }, 200);
    } else {
        dropdown.classList.add('show');
        // Close when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeDueDateDropdown);
        }, 10);
    }
}

function closeDueDateDropdown(event) {
    const dropdown = document.getElementById('dueDateOptions');
    const btn = document.getElementById('dueDateBtn');
    
    if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeDueDateDropdown);
    }
}

function setDueDate(option) {
    const dueDateInput = document.getElementById('taskDueDate');
    const dueDateText = document.getElementById('dueDateText');
    const dropdown = document.getElementById('dueDateOptions');
    const dueDateBtn = document.getElementById('dueDateBtn');
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    switch (option) {
        case 'today':
            dueDateInput.value = formatDateInput(today);
            dueDateText.textContent = 'Today';
            // Auto-save after setting date
            autoSaveTask();
            break;
        case 'tomorrow':
            dueDateInput.value = formatDateInput(tomorrow);
            dueDateText.textContent = 'Tomorrow';
            // Auto-save after setting date
            autoSaveTask();
            break;
        case 'custom':
            // Get button position
            const btnRect = dueDateBtn.getBoundingClientRect();
            const container = dueDateBtn.closest('.form-item-content');
            const containerRect = container.getBoundingClientRect();
            
            // Position date input over the button
            dueDateInput.style.display = 'block';
            dueDateInput.style.position = 'absolute';
            dueDateInput.style.top = (btnRect.top - containerRect.top) + 'px';
            dueDateInput.style.left = (btnRect.left - containerRect.left) + 'px';
            dueDateInput.style.width = btnRect.width + 'px';
            dueDateInput.style.height = btnRect.height + 'px';
            dueDateInput.style.opacity = '0';
            dueDateInput.style.zIndex = '1001';
            dueDateInput.style.cursor = 'pointer';
            
            // Focus and try to open picker
            dueDateInput.focus();
            dueDateInput.click();
            
            // Try showPicker if available
            if (dueDateInput.showPicker) {
                try {
                    dueDateInput.showPicker();
                } catch (e) {
                    console.log('showPicker not supported, using click');
                }
            }
            
            const handleDateChange = () => {
                if (dueDateInput.value) {
                    const selectedDate = new Date(dueDateInput.value);
                    
                    // Check if it's today or tomorrow
                    const todayStr = today.toDateString();
                    const tomorrowStr = tomorrow.toDateString();
                    const selectedStr = selectedDate.toDateString();
                    
                    if (selectedStr === todayStr) {
                        dueDateText.textContent = 'Today';
                    } else if (selectedStr === tomorrowStr) {
                        dueDateText.textContent = 'Tomorrow';
                    } else {
                        dueDateText.textContent = formatDateShort(selectedDate);
                    }
                } else {
                    dueDateText.textContent = 'Pick a date';
                }
                
                // Hide the input
                dueDateInput.style.display = 'none';
                dueDateInput.style.position = 'static';
                dueDateInput.style.opacity = '1';
                dueDateInput.style.zIndex = 'auto';
                
                // Auto-save after date change
                autoSaveTask();
            };
            
            const handleDateBlur = () => {
                setTimeout(() => {
                    handleDateChange();
                }, 200);
            };
            
            dueDateInput.addEventListener('change', handleDateChange, { once: true });
            dueDateInput.addEventListener('blur', handleDateBlur, { once: true });
            
            break;
    }
    
    dropdown.classList.remove('show');
    document.removeEventListener('click', closeDueDateDropdown);
}

function formatDateInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateShort(date) {
    const options = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

function cancelTaskEdit() {
    console.log('Canceling task edit');
    window.currentEditingTask = null;
    
    // Hide task details panel
    const taskDetailsPanel = document.getElementById('taskDetailsPanel');
    if (taskDetailsPanel) {
        taskDetailsPanel.style.display = 'none';
    }
    
    // Refresh task list when editor closes to ensure data is up to date
    console.log('Refreshing task list after closing editor...');
    renderTasksList();
    updateTaskCounts();
}

// List Navigation
function switchTaskList(listType) {
    currentTaskList = listType;
    
    // Update active list in sidebar
    document.querySelectorAll('.task-list-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-list="${listType}"]`).classList.add('active');
    
    // Update header
    const listTitles = {
        all: 'All Tasks',
        today: 'My Day',
        important: 'Important',
        completed: 'Completed'
    };
    
    let title = listTitles[listType];
    if (!title && isCustomList(listType)) {
        const list = customLists.find(l => l.id === listType);
        title = list ? list.title : 'Custom List';
    }
    document.getElementById('listTitle').textContent = title;
    renderTasksList();
}

function setupTaskEventListeners() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;
    
    // Remove existing listeners to prevent duplicates
    const existingHandler = tasksList._taskClickHandler;
    const existingChangeHandler = tasksList._taskChangeHandler;
    
    if (existingHandler) {
        tasksList.removeEventListener('click', existingHandler);
    }
    if (existingChangeHandler) {
        tasksList.removeEventListener('change', existingChangeHandler);
    }
    
    // Create new handlers and store references
    const clickHandler = (event) => handleTaskClick(event);
    const changeHandler = (event) => handleTaskChange(event);
    
    tasksList._taskClickHandler = clickHandler;
    tasksList._taskChangeHandler = changeHandler;
    
    // Add event listeners
    tasksList.addEventListener('click', clickHandler);
    tasksList.addEventListener('change', changeHandler);
    
    console.log('Task event listeners setup complete');
}

function handleTaskClick(event) {
    const target = event.target;
    const taskItem = target.closest('.task-item');
    if (!taskItem) return;
    
    const taskId = taskItem.dataset.taskId;
    const action = target.dataset.action;
    
    console.log('Task click:', { taskId, action, target });
    
    if (action === 'important') {
        event.stopPropagation();
        toggleTaskImportant(taskId);
    } else if (action === 'delete') {
        event.stopPropagation();
        deleteTask(taskId);
    } else if (target.classList.contains('task-content') || target.closest('.task-content')) {
        // Click on task content - open edit form directly
        editTask(taskId);
    }
}

function handleTaskChange(event) {
    const target = event.target;
    if (target.classList.contains('task-check')) {
        const taskId = target.dataset.taskId;
        console.log('Task checkbox changed:', taskId);
        toggleTaskComplete(taskId);
    }
}
// Search
function setupTaskSearch() {
    const searchInput = document.getElementById('taskSearchInput');
    const clearBtn = document.getElementById('clearTaskSearch');
    
    if (!searchInput || !clearBtn) return;
    
    const debouncedSearch = debounce((value) => {
        taskSearchQuery = value;
        renderTasksList();
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        clearBtn.style.display = value ? 'block' : 'none';
        debouncedSearch(value);
    });
}

function clearTaskSearch() {
    const searchInput = document.getElementById('taskSearchInput');
    const clearBtn = document.getElementById('clearTaskSearch');
    
    if (!searchInput || !clearBtn) return;
    
    searchInput.value = '';
    taskSearchQuery = '';
    clearBtn.style.display = 'none';
    renderTasksList();
    searchInput.focus();
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
}

function formatTaskDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    }
}

function hasAnyTaskUrl(task) {
    return task.url1 || task.url2 || task.url3;
}

function getTaskUrlCount(task) {
    let count = 0;
    if (task.url1) count++;
    if (task.url2) count++;
    if (task.url3) count++;
    return count;
}

function isCustomList(listId) {
    return listId && !['all', 'today', 'important', 'completed'].includes(listId);
}

function getTaskCountForList(listId) {
    return tasks.filter(task => task.parentId === listId).length;
}

function getListId(listIdOrName) {
    // If it's already an ID, return it
    if (customLists.find(l => l.id === listIdOrName)) {
        return listIdOrName;
    }
    // If it's a name, find the ID
    const list = customLists.find(l => l.title === listIdOrName);
    return list ? list.id : null;
}

// Initialize Tasks
async function initTasks() {
    console.log('Initializing tasks...');
    
    // Wait for DOM to be fully ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    // Check if required elements exist
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) {
        console.error('Required DOM elements not found, retrying...');
        setTimeout(initTasks, 100);
        return;
    }
    
    setupTaskSearch();
    await loadTasks(); // This now loads both tasks and lists
    setupTaskEventListeners(); // Setup event listeners after loading
    switchTaskList('today');
}