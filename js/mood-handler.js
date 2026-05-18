// Add period mood buttons event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.add-period-mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const period = btn.dataset.period;
            addPeriodMood(period);
        });
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.remove-mood-entry-btn')) {
            const entry = e.target.closest('.mood-entry');
            removePeriodMood(entry);
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('mood-cat')) {
            const entry = e.target.closest('.mood-entry');
            const feelSelect = entry.querySelector('.mood-feel');
            if (window.app && window.app.ui) {
                window.app.ui.updateMoodFeelings(e.target.value, feelSelect);
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('mood-slider')) {
            const entry = e.target.closest('.mood-entry');
            const valDisplay = entry.querySelector('.mood-val-display');
            const emoji = getMoodEmoji(e.target.value);
            valDisplay.innerText = `${e.target.value} ${emoji}`;
        }
    });
});

function addPeriodMood(period) {
    const container = document.getElementById(`${period}-moods`);
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'mood-entry';
    entry.innerHTML = `
        <button class="remove-mood-entry-btn" title="Remove"><i class="fas fa-times"></i></button>
        <div class="slider-group">
            <div class="flex-between">
                <label>Mood Level</label>
                <span class="mood-val-display">5 ${getMoodEmoji(5)}</span>
            </div>
            <input type="range" class="mood-slider" min="1" max="10" value="5">
        </div>
        <div class="mood-dropdowns-grid">
            <div class="dropdown-group">
                <label>Category</label>
                <select class="mood-cat">
                    <option value="">Select Category...</option>
                    <option value="positive_high_energy">Positive High Energy</option>
                    <option value="neutral_balanced">Neutral Balanced</option>
                    <option value="low_energy_tired">Low Energy Tired</option>
                    <option value="negative_heavy">Negative Heavy</option>
                    <option value="cognitive">Cognitive</option>
                </select>
            </div>
            <div class="dropdown-group">
                <label>Feeling</label>
                <select class="mood-feel" disabled>
                    <option value="">Select Category First</option>
                </select>
            </div>
        </div>
    `;

    container.appendChild(entry);
    if (window.app && window.app.ui) {
        window.app.ui.showToast('Mood entry added');
        window.app.ui.debouncedSave();
    }
}

function removePeriodMood(entry) {
    const container = entry.parentElement;
    const entries = container.querySelectorAll('.mood-entry');
    
    if (entries.length <= 1) {
        if (window.app && window.app.ui) {
            window.app.ui.showToast('At least one mood entry required');
        }
        return;
    }

    if (confirm('Remove this mood entry?')) {
        entry.remove();
        if (window.app && window.app.ui) {
            window.app.ui.debouncedSave();
            window.app.ui.showToast('Mood entry removed');
        }
    }
}

function getMoodEmoji(level) {
    if (level >= 9) return '\u{1F31F}';
    if (level >= 7) return '\u{1F60A}';
    if (level >= 5) return '\u{1F610}';
    if (level >= 3) return '\u{1F614}';
    return '\u{1F622}';
}
