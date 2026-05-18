// Decisions Handler
let draggedItem = null;
let longPressTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-decision-json-btn');
    const jsonInput = document.getElementById('decisions-json');
    const container = document.getElementById('decisions-container');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const jsonText = jsonInput.value.trim();
            if (!jsonText) {
                alert('Please paste JSON first');
                return;
            }

            try {
                const parsed = JSON.parse(jsonText);
                addDecisionItem(parsed);
                jsonInput.value = '';
                if (window.app && window.app.ui) {
                    window.app.ui.showToast('Added to decisions array');
                    window.app.ui.debouncedSave();
                }
            } catch (e) {
                alert('Invalid JSON format');
            }
        });
    }

    container?.addEventListener('click', (e) => {
        if (e.target.closest('.remove-decision-btn')) {
            e.preventDefault();
            e.stopPropagation();
            e.target.closest('.decision-item').remove();
            updateDecisionNumbers();
            if (window.app && window.app.ui) {
                window.app.ui.debouncedSave();
            }
        } else if (e.target.closest('.edit-decision-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.decision-item');
            enterEditMode(item);
        } else if (e.target.closest('.save-decision-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.decision-item');
            saveEdit(item);
        } else if (e.target.closest('.cancel-decision-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.decision-item');
            exitEditMode(item);
        } else if (e.target.closest('.decision-header')) {
            const item = e.target.closest('.decision-item');
            if (!item.classList.contains('editing')) {
                item.classList.toggle('expanded');
            }
        }
    });
});

function addDecisionItem(data) {
    const container = document.getElementById('decisions-container');
    if (!container) return;

    const count = container.querySelectorAll('.decision-item').length + 1;
    const preview = JSON.stringify(data).substring(0, 50) + '...';

    const item = document.createElement('div');
    item.className = 'decision-item';
    item.draggable = false;
    item.innerHTML = `
        <div class="decision-header">
            <div class="decision-number">${count}</div>
            <div class="decision-preview">${preview}</div>
            <i class="fas fa-chevron-down decision-toggle"></i>
            <button class="edit-decision-btn" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="remove-decision-btn" title="Remove"><i class="fas fa-times"></i></button>
        </div>
        <div class="decision-content">
            <div class="decision-json">${JSON.stringify(data, null, 2)}</div>
        </div>
        <div class="decision-edit-area">
            <textarea class="decision-edit-textarea">${JSON.stringify(data, null, 2)}</textarea>
            <div class="decision-edit-actions">
                <button class="save-decision-btn">Save</button>
                <button class="cancel-decision-btn">Cancel</button>
            </div>
        </div>
    `;
    item.dataset.json = JSON.stringify(data);

    setupDragAndDrop(item);
    container.appendChild(item);
}

function setupDragAndDrop(item) {
    const numberEl = item.querySelector('.decision-number');
    
    // Long press to enable drag
    numberEl.addEventListener('mousedown', (e) => {
        longPressTimer = setTimeout(() => {
            item.draggable = true;
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    });

    numberEl.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            item.draggable = true;
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    }, { passive: true });

    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
        numberEl.addEventListener(evt, () => {
            clearTimeout(longPressTimer);
        });
    });

    item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        item.draggable = false;
        draggedItem = null;
        updateDecisionNumbers();
        if (window.app && window.app.ui) {
            window.app.ui.debouncedSave();
        }
    });

    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem !== item) {
            const container = item.parentElement;
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggedItem);
            } else {
                container.insertBefore(draggedItem, afterElement);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.decision-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function enterEditMode(item) {
    item.classList.add('editing');
    item.classList.remove('expanded');
}

function exitEditMode(item) {
    item.classList.remove('editing');
    const textarea = item.querySelector('.decision-edit-textarea');
    textarea.value = item.dataset.json ? JSON.stringify(JSON.parse(item.dataset.json), null, 2) : '';
}

function saveEdit(item) {
    const textarea = item.querySelector('.decision-edit-textarea');
    try {
        const parsed = JSON.parse(textarea.value);
        item.dataset.json = JSON.stringify(parsed);
        
        const preview = JSON.stringify(parsed).substring(0, 50) + '...';
        item.querySelector('.decision-preview').textContent = preview;
        item.querySelector('.decision-json').textContent = JSON.stringify(parsed, null, 2);
        
        item.classList.remove('editing');
        
        if (window.app && window.app.ui) {
            window.app.ui.showToast('Decision updated');
            window.app.ui.debouncedSave();
        }
    } catch (e) {
        alert('Invalid JSON format');
    }
}

function updateDecisionNumbers() {
    document.querySelectorAll('.decision-item').forEach((item, index) => {
        const numberEl = item.querySelector('.decision-number');
        if (numberEl) numberEl.textContent = index + 1;
    });
}

function collectDecisions() {
    const decisions = [];
    document.querySelectorAll('.decision-item').forEach(item => {
        try {
            const data = JSON.parse(item.dataset.json);
            decisions.push(data);
        } catch (e) {}
    });
    return decisions;
}

function loadDecisions(decisions) {
    const container = document.getElementById('decisions-container');
    if (!container) return;
    
    // Always clear container first
    container.innerHTML = '';
    
    // Only load if decisions exist and is an array
    if (Array.isArray(decisions) && decisions.length > 0) {
        decisions.forEach(d => addDecisionItem(d));
    }
}

// Expose functions
window.decisionsHandler = {
    collect: collectDecisions,
    load: loadDecisions,
    add: addDecisionItem
};
