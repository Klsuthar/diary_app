class UI {
    constructor(storage) {
        this.storage = storage;
        // Ensure current date is properly set to today (local date)
        this.currentDate = this.formatDateKey(new Date());

        // Reference Date: July 4, 2003 (local midnight)
        this.referenceDate = new Date(2003, 6, 4);

        // Track changes
        this.hasUnsavedChanges = false;
        this.lastSavedData = null;

        this.moodCategories = {
            'positive_high_energy': ['happy', 'calm', 'peaceful', 'relaxed', 'content', 'motivated', 'energetic', 'confident', 'hopeful', 'satisfied'],
            'neutral_balanced': ['neutral', 'normal', 'stable', 'okay', 'composed', 'indifferent'],
            'low_energy_tired': ['tired', 'sleepy', 'exhausted', 'lazy', 'drained', 'dull'],
            'negative_heavy': ['stressed', 'anxious', 'irritated', 'frustrated', 'overwhelmed', 'sad', 'low', 'lonely', 'bored'],
            'cognitive': ['focused', 'distracted', 'confused', 'overthinking', 'mentally_heavy', 'mentally_clear']
        };

        this.multiSelectMode = false;
        this.selectedEntries = new Set();
        this.longPressTimer = null;
        this.currentFilter = 'all';
        this.periods = ['morning', 'afternoon', 'evening', 'night'];

        this.initElements();
        this.initElements();

        // ------------- HELPERS -------------
        this.debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        this.animate = (el, keyframes, options = { duration: 300, easing: 'ease' }) => {
            if (!el) return;
            return el.animate(keyframes, options).finished;
        };

        const saveWithDateGuard = this.debounce((targetDate) => {
            // Ignore stale debounced callbacks from a previously selected date
            if (this.hasUnsavedChanges && targetDate === this.currentDate) {
                this.saveEntry();
            }
        }, 500);
        this.debouncedSave = () => saveWithDateGuard(this.currentDate);

        // Async storage is ready; kick off initial load after DB opens
        this._storageReady = this.storage._dbPromise;

        this.initEventListeners();

        // Kick off async initialization (load entry + suggestions)
        // Using an arrow IIFE so the constructor stays synchronous
        (async () => {
            await this.loadEntry(this.currentDate);
            this.updateDateDisplay();
            await this.updateWeatherSuggestions();
        })();
    }

    initElements() {
        // Nav & Tabs
        this.tabs = document.querySelectorAll('.tab-content');
        this.navItems = document.querySelectorAll('.nav-item');

        // Date
        this.dateDisplay = document.getElementById('display-date');
        this.weekdayDisplay = document.getElementById('display-weekday');
        this.dateBtn = document.getElementById('date-btn');
        this.hiddenDateInput = document.getElementById('entry-date');
        this.dayCounter = document.getElementById('day-counter');

        // Multi-select
        this.multiHeader = document.getElementById('multi-select-header');
        this.selectionCount = document.getElementById('selection-count');
        this.exportMultiBtn = document.getElementById('export-multi');
        this.deleteMultiBtn = document.getElementById('delete-multi');

        // Toast & Loading
        this.toast = document.getElementById('toast');
        this.loading = document.getElementById('loading');
    }

    parseDateKey(dateStr) {
        if (typeof dateStr !== 'string') return new Date(NaN);
        const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return new Date(NaN);

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        return new Date(year, month - 1, day);
    }

    formatDateKey(dateObj) {
        if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }

    addDaysToDateKey(dateStr, offset) {
        const d = this.parseDateKey(dateStr);
        if (Number.isNaN(d.getTime())) return dateStr;
        d.setDate(d.getDate() + offset);
        return this.formatDateKey(d);
    }

    getEntrySortTime(dateKey, entry) {
        const candidates = [dateKey, entry?.date];

        for (const raw of candidates) {
            if (typeof raw !== 'string') continue;
            const value = raw.trim();
            if (!value) continue;

            const strict = this.parseDateKey(value);
            if (!Number.isNaN(strict.getTime())) {
                return strict.getTime();
            }

            // Support older/loose formats like YYYY-M-D or ISO with time
            const relaxedMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (relaxedMatch) {
                const parsed = new Date(
                    Number(relaxedMatch[1]),
                    Number(relaxedMatch[2]) - 1,
                    Number(relaxedMatch[3])
                );
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed.getTime();
                }
            }
        }

        return Number.NEGATIVE_INFINITY;
    }

    getEntryMoodScore(entry) {
        const morning = entry?.mental_and_emotional_health?.mood_timeline?.morning;
        const values = Array.isArray(morning)
            ? morning.map(item => Number(item?.mood_level)).filter(Number.isFinite)
            : [Number(morning?.mood_level)].filter(Number.isFinite);

        if (!values.length) return 5;
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }



    initEventListeners() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchTab(item.dataset.target));
        });

        // Date Controls
        const updateDateUI = (change) => {
            // Check for unsaved changes
            if (this.hasUnsavedChanges) {
                if (!confirm('You have unsaved changes. Do you want to save before navigating?')) {
                    return;
                }
                this.saveEntry(true);
            }
            
            const content = document.querySelector('.content-area');
            content.style.opacity = '0';
            setTimeout(() => {
                this.changeDate(change);
                content.style.opacity = '1';
            }, 200);
        };

        const prevBtn = document.getElementById('prev-date');
        const nextBtn = document.getElementById('next-date');
        document.querySelectorAll('#prev-date').forEach(btn => btn.addEventListener('click', () => updateDateUI(-1)));
        document.querySelectorAll('#next-date').forEach(btn => btn.addEventListener('click', () => updateDateUI(1)));

        this.dateBtn.addEventListener('click', () => {
            // Fallback for browsers that don't support showPicker()
            if (this.hiddenDateInput.showPicker) {
                try {
                    this.hiddenDateInput.showPicker();
                } catch (e) {
                    // Fallback: focus and click the input
                    this.hiddenDateInput.focus();
                    this.hiddenDateInput.click();
                }
            } else {
                // Fallback: focus and click the input
                this.hiddenDateInput.focus();
                this.hiddenDateInput.click();
            }
        });

        this.hiddenDateInput.addEventListener('change', (e) => {
            if (e.target.value) this.setDate(e.target.value);
        });

        // Toolbar
        document.getElementById('save-btn').addEventListener('click', () => this.saveEntry(true));
        document.getElementById('export-btn').addEventListener('click', () => this.exportEntry());

        // Menu
        const menuBtn = document.getElementById('menu-btn');
        const menuContent = document.getElementById('main-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuContent.classList.toggle('show');
        });
        document.addEventListener('click', () => menuContent.classList.remove('show'));

        document.getElementById('menu-clear').addEventListener('click', () => {
            if (confirm('Clear current entry?')) {
                this.resetForm();
                this.saveEntry();
            }
        });
        document.getElementById('menu-share').addEventListener('click', () => this.shareEntry());
        document.getElementById('menu-export')?.addEventListener('click', () => this.exportEntry());
        document.getElementById('menu-import').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleFileImport(e, false));

        document.getElementById('menu-backup').addEventListener('click', () => this.createBackup());
        document.getElementById('menu-restore').addEventListener('click', () => document.getElementById('import-backup-file').click());
        document.getElementById('import-backup-file').addEventListener('change', (e) => this.handleFileImport(e, true));
        document.getElementById('menu-refresh').addEventListener('click', () => this.hardRefresh());

        // Multi-select
        this.initMultiSelectListeners();
        this.initSearchListeners();


        // ---------------- REAL-TIME & SLIDERS ----------------

        // AQI
        const aqiSlider = document.getElementById('aqi');
        const aqiLabel = document.getElementById('aqi-label');
        if (aqiSlider && aqiLabel) {
            const update = () => {
                const val = parseInt(aqiSlider.value);
                document.getElementById('aqi-value').innerText = val;
                this.updateAQILabel(val, aqiLabel);
                this.debouncedSave();
            }
            aqiSlider.addEventListener('input', update);
        }

        // UV
        const uvSlider = document.getElementById('uv-index');
        const uvLabel = document.getElementById('uv-label');
        if (uvSlider && uvLabel) {
            const update = () => {
                const val = parseInt(uvSlider.value);
                document.getElementById('uv-value').innerText = val;
                this.updateUVLabel(val, uvLabel);
                this.debouncedSave();
            }
            uvSlider.addEventListener('input', update);
        }

        // Sleep Quality
        const sleepSlider = document.getElementById('sleep-quality');
        const sleepLabel = document.getElementById('sleep-qual-label');
        if (sleepSlider && sleepLabel) {
            sleepSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                document.getElementById('sleep-qual-val').innerText = val;

                let text = 'Average 😐';
                if (val >= 9) text = 'Excellent 🌟';
                else if (val >= 7) text = 'Good 😊';
                else if (val <= 2) text = 'Terrible 😢';
                else if (val <= 4) text = 'Poor 😔';

                sleepLabel.innerText = text;
                this.debouncedSave();
            });
        }

        // Generic Slider Value Update
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const container = slider.parentElement;
                const valSpan = container.querySelector('.slider-value span:first-child') || container.querySelector('.mood-val-display');
                if (valSpan) {
                    if (slider.classList.contains('mood-slider')) {
                        const emoji = this.getMoodEmoji(slider.value);
                        const moodValue = slider.closest('.mood-entry')?.querySelector('.mood-val-display');
                        if (moodValue) moodValue.innerText = `${slider.value} ${emoji}`;
                    } else {
                        valSpan.innerText = slider.value;
                    }
                }
                this.hasUnsavedChanges = true;
                this.debouncedSave();
            });
        });

        // ------------------ BODY TAB ------------------
        const updateBMI = () => {
            const w = parseFloat(document.getElementById('weight').value);
            const h = parseFloat(document.getElementById('height').value);

            let bmiDisplay = document.getElementById('bmi-display');
            if (!bmiDisplay) {
                const container = document.getElementById('weight').closest('.card') || document.getElementById('weight').parentElement.parentElement.parentElement;
                if (container) {
                    bmiDisplay = document.createElement('div');
                    bmiDisplay.id = 'bmi-display';
                    bmiDisplay.style.marginTop = '15px';
                    bmiDisplay.style.textAlign = 'center';
                    bmiDisplay.style.padding = '10px';
                    bmiDisplay.style.background = 'rgba(255,255,255,0.05)';
                    bmiDisplay.style.borderRadius = '8px';
                    bmiDisplay.style.transition = 'opacity 0.3s';
                    container.appendChild(bmiDisplay);
                }
            }

            if (bmiDisplay && w > 0 && h > 0) {
                const bmi = (w / ((h / 100) ** 2)).toFixed(1);
                let cls = 'bmi-normal', text = 'Normal';
                if (bmi < 18.5) { cls = 'bmi-underweight'; text = 'Underweight'; }
                else if (bmi >= 25 && bmi < 30) { cls = 'bmi-overweight'; text = 'Overweight'; }
                else if (bmi >= 30) { cls = 'bmi-obese'; text = 'Obese'; }

                bmiDisplay.innerHTML = `<span style="font-size:1.2em; font-weight:bold;">BMI: ${bmi}</span> <br> <span class="${cls}">${text}</span>`;
                bmiDisplay.style.opacity = '1';
            } else if (bmiDisplay) {
                bmiDisplay.style.opacity = '0';
            }
        };

        const wInput = document.getElementById('weight');
        const hInput = document.getElementById('height');
        if (wInput) wInput.addEventListener('input', () => { updateBMI(); this.debouncedSave(); });
        if (hInput) hInput.addEventListener('input', () => { updateBMI(); this.debouncedSave(); });

        // Hydration Scale Animation
        const updateGlasses = () => {
            const val = parseFloat(document.getElementById('water-intake').value) || 0;
            const glassCount = Math.min(8, Math.floor(val / 0.25));
            const glasses = document.querySelectorAll('.glass-indicators i');
            glasses.forEach((glass, idx) => {
                glass.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                if (idx < glassCount) {
                    glass.className = 'fas fa-glass-water filled';
                    glass.style.color = '#3498db';
                    glass.style.transform = 'scale(1.2)';
                } else {
                    glass.className = 'far fa-circle';
                    glass.style.color = '#ccc';
                    glass.style.transform = 'scale(1)';
                }
            });
        };
        const waterInput = document.getElementById('water-intake');
        if (waterInput) waterInput.addEventListener('input', () => { updateGlasses(); this.debouncedSave(); });

        document.querySelectorAll('.quick-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!e.currentTarget.dataset.add) return;
                const add = parseFloat(e.currentTarget.dataset.add);
                const input = document.getElementById('water-intake');
                if (input) {
                    input.value = (parseFloat(input.value || 0) + add).toFixed(2);
                    input.dispatchEvent(new Event('input'));

                    // Button Pulse
                    const originalScale = e.currentTarget.style.transform;
                    e.currentTarget.style.transform = 'scale(0.95)';
                    setTimeout(() => e.currentTarget.style.transform = originalScale || '', 100);
                }
            });
        });

        // ------------------ MENTAL TAB ------------------
        document.querySelectorAll('.mood-cat').forEach(select => {
            select.addEventListener('change', (e) => {
                const periodCard = e.target.closest('.period-card');
                const feelSelect = periodCard.querySelector('.mood-feel');
                this.updateMoodFeelings(e.target.value, feelSelect);
                this.debouncedSave();
            });
        });

        // Add Mood Button
        document.getElementById('add-mood-btn')?.addEventListener('click', () => this.addMoodEntry());

        // Delegate remove button clicks
        document.getElementById('timeline-container')?.addEventListener('click', (e) => {
            if (e.target.closest('.remove-mood-btn')) {
                const card = e.target.closest('.period-card');
                if (card) this.removeMoodEntry(card);
            }
        });

        // ------------------ SUMMARY TAB ------------------
        // Import Buttons
        const animateImport = async (btnId, section) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.disabled = true;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<span class="spinner"></span> Importing...';
            await new Promise(r => setTimeout(r, 600));
            this.importLastDayData(section);
            btn.innerHTML = '<i class="fas fa-check"></i> Done';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }, 1500);
        };
        document.getElementById('import-last-env')?.addEventListener('click', () => animateImport('import-last-env', 'environment'));
        document.getElementById('import-last-care')?.addEventListener('click', () => animateImport('import-last-care', 'personal_care'));

        // Suggestions Autocomplete
        document.querySelectorAll('.suggestion-chips-container').forEach(container => {
            const inputId = container.dataset.input;
            if (!inputId) return;
            const input = document.getElementById(inputId);
            if (!input) return;

            // Chip Click
            container.querySelectorAll('.chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    this.appendReason(inputId, chip.innerText); // Reusing appendReason logic is safer
                    input.dispatchEvent(new Event('input'));
                    container.querySelectorAll('.chip').forEach(c => c.style.display = ''); // Reset check
                });
            });

            // Input Filter
            input.addEventListener('input', () => {
                const val = input.value.toLowerCase();
                const terms = val.split(',').map(s => s.trim());
                const currentTerm = terms[terms.length - 1];

                container.querySelectorAll('.chip').forEach(chip => {
                    if (!currentTerm) {
                        chip.style.display = '';
                        chip.classList.remove('highlight');
                    } else if (chip.innerText.toLowerCase().includes(currentTerm)) {
                        chip.style.display = '';
                        chip.classList.add('highlight');
                    } else {
                        chip.style.display = 'none';
                        chip.classList.remove('highlight');
                    }
                });
            });
        });

        // Top 5 Apps Validation
        const validateApps = () => {
            const screenInput = document.getElementById('screen-time');
            if (!screenInput) return;

            // Parse Screen Time (HH:MM or 5h 30m)
            let totalScreenMins = 0;
            const sVal = screenInput.value;
            // HH:MM format from type="time"
            if (sVal.includes(':')) {
                const [h, m] = sVal.split(':').map(Number);
                totalScreenMins = (h * 60) + m;
            }

            if (totalScreenMins <= 0) {
                screenInput.classList.remove('input-warning');
                return;
            }

            let totalAppMins = 0;
            document.querySelectorAll('.app-time').forEach(inp => {
                const val = inp.value; // HH:MM
                if (val.includes(':')) {
                    const [h, m] = val.split(':').map(Number);
                    totalAppMins += (h * 60) + m;
                }
            });

            if (totalAppMins > totalScreenMins) {
                screenInput.classList.add('input-warning');
                screenInput.title = "Apps usage exceeds total screen time";
            } else {
                screenInput.classList.remove('input-warning');
                screenInput.title = "";
            }
        };

        document.getElementById('screen-time')?.addEventListener('input', () => { validateApps(); this.debouncedSave(); });
        document.querySelectorAll('.app-time').forEach(el => el.addEventListener('input', () => { validateApps(); this.debouncedSave(); }));


        // ---------------- GLOBAL ----------------
        // Generic Auto-Save & Counters
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type !== 'range') { // Sliders handled
                el.addEventListener('input', () => {
                    this.hasUnsavedChanges = true;
                    this.debouncedSave();
                    this.updateTabIndicators();
                });
            }
        });

        // Populate Weather Suggestions from Past Data
        this.updateWeatherSuggestions();

        document.querySelectorAll('textarea').forEach(area => {
            const countId = area.id + '-count';
            const counter = document.getElementById(countId);
            if (counter) {
                const limitMatch = counter.innerText.match(/\/(\d+)/);
                const limit = limitMatch ? parseInt(limitMatch[1]) : null;
                const update = () => {
                    const len = area.value.length;
                    const words = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
                    if (limit) {
                        counter.innerText = `(${len}/${limit})`;
                        if (len >= limit) counter.style.color = 'red';
                        else counter.style.color = '#999';
                    } else {
                        counter.innerText = `${words} words, ${len} chars`;
                        counter.style.color = '#999';
                    }
                };
                area.addEventListener('input', update);
                update(); // init
            }
        });
    }

    // -------------------------------------------------------------------------
    // LOGIC
    // -------------------------------------------------------------------------

    updateMoodFeelings(category, feelSelect) {
        feelSelect.innerHTML = '<option value="">Select Feeling...</option>';
        if (!category || !this.moodCategories[category]) {
            feelSelect.disabled = true;
            return;
        }
        feelSelect.disabled = false;
        this.moodCategories[category].forEach(feeling => {
            const opt = document.createElement('option');
            opt.value = feeling;
            opt.innerText = feeling;
            feelSelect.appendChild(opt);
        });
    }

    getMoodEmoji(level) {
        if (level >= 9) return '\u{1F31F}';
        if (level >= 7) return '\u{1F60A}';
        if (level >= 5) return '\u{1F610}';
        if (level >= 3) return '\u{1F614}';
        return '\u{1F622}';
    }

    getPeriodObject(prefix) {
        return this.periods.reduce((result, period) => {
            result[period] = document.getElementById(`${prefix}-${period}`)?.value || "";
            return result;
        }, {});
    }

    setPeriodObject(prefix, value) {
        this.periods.forEach((period, index) => {
            const el = document.getElementById(`${prefix}-${period}`);
            if (!el) return;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                el.value = value[period] || "";
            } else {
                el.value = index === 0 ? (value || "") : "";
            }
        });
    }

    hasPeriodObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value) &&
            this.periods.every(period => Object.prototype.hasOwnProperty.call(value, period));
    }

    getMealEntry(mealId) {
        const meal = document.getElementById(mealId)?.value || "";
        const appetiteValue = document.getElementById(`${mealId}-appetite`)?.value;
        return {
            meal,
            appetite_index: appetiteValue !== undefined && appetiteValue !== "" ? Number(appetiteValue) : null
        };
    }

    setMealEntry(mealId, value) {
        const mealValue = value && typeof value === 'object' && !Array.isArray(value)
            ? value.meal
            : value;
        const appetiteValue = value && typeof value === 'object' && !Array.isArray(value)
            ? value.appetite_index
            : null;

        const mealEl = document.getElementById(mealId);
        if (mealEl) mealEl.value = mealValue || "";

        const appetiteEl = document.getElementById(`${mealId}-appetite`);
        const appetiteDisplay = document.getElementById(`${mealId}-appetite-value`);
        if (appetiteEl) {
            appetiteEl.value = appetiteValue === null || appetiteValue === undefined ? 5 : appetiteValue;
            if (appetiteDisplay) appetiteDisplay.innerText = appetiteEl.value;
        }
    }

    isMealEntryComplete(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value) &&
            !!value.meal && value.appetite_index !== null && value.appetite_index !== undefined;
    }

    isEntryComplete(entry) {
        // Check Basic tab
        const basicComplete = entry.environment?.temperature_c && 
                            entry.environment?.weather_condition && 
                            entry.environment?.air_quality_index !== null &&
                            entry.environment?.humidity_percent !== null &&
                            entry.environment?.uv_index !== null &&
                            entry.environment?.environment_experience;
        
        // Check Body tab
        const bodyComplete = entry.body_measurements?.weight_kg && 
                           entry.body_measurements?.height_cm && 
                           entry.body_measurements?.chest && 
                           entry.body_measurements?.belly &&
                           entry.health_and_fitness?.sleep_hours && 
                           entry.health_and_fitness?.sleep_quality !== null &&
                           entry.health_and_fitness?.sleep_quality_description &&
                           entry.health_and_fitness?.steps_count !== null &&
                           entry.health_and_fitness?.steps_distance_km !== null &&
                           entry.health_and_fitness?.kilocalorie !== null &&
                           entry.health_and_fitness?.water_intake_liters !== null &&
                           this.hasPeriodObject(entry.health_and_fitness?.medications_taken) &&
                           this.hasPeriodObject(entry.health_and_fitness?.physical_symptoms);
        
        // Check Mental tab - Handle arrays
        const allMoodTimelinesComplete = ['morning', 'afternoon', 'evening', 'night'].every(period => {
            const timeline = entry.mental_and_emotional_health?.mood_timeline?.[period];
            if (Array.isArray(timeline)) {
                return timeline.length > 0 && timeline.every(m => m.mood_category && m.mood_feeling);
            }
            return timeline?.mood_category && timeline?.mood_feeling;
        });
        const mentalComplete = entry.mental_and_emotional_health?.mental_state && 
                             entry.mental_and_emotional_health?.mental_state_reason &&
                             allMoodTimelinesComplete &&
                             entry.mental_and_emotional_health?.energy_level !== null &&
                             entry.mental_and_emotional_health?.energy_reason &&
                             entry.mental_and_emotional_health?.stress_level !== null &&
                             entry.mental_and_emotional_health?.stress_reason &&
                             entry.mental_and_emotional_health?.meditation_status &&
                             entry.mental_and_emotional_health?.meditation_duration_min !== null;
        
        // Check Diet tab
        const dietComplete = this.isMealEntryComplete(entry.diet_and_nutrition?.breakfast) &&
                           this.isMealEntryComplete(entry.diet_and_nutrition?.lunch) &&
                           this.isMealEntryComplete(entry.diet_and_nutrition?.dinner) &&
                           entry.diet_and_nutrition?.additional_items &&
                           entry.personal_care?.face_product_name &&
                           entry.personal_care?.face_product_brand &&
                           entry.personal_care?.hair_product_name &&
                           entry.personal_care?.hair_product_brand &&
                           entry.personal_care?.hair_oil &&
                           entry.personal_care?.skincare_routine;
        
        // Check Summary tab
        const allAppsComplete = entry.activities_and_productivity?.most_used_apps && 
                              entry.activities_and_productivity.most_used_apps.length === 5 &&
                              entry.activities_and_productivity.most_used_apps.every(app => app.name && app.time);
        const summaryComplete = entry.additional_notes?.key_events &&
                              entry.daily_activity_summary && 
                              entry.overall_day_experience &&
                              entry.additional_notes?.other_note_status &&
                              entry.activities_and_productivity?.tasks_today_english &&
                              entry.activities_and_productivity?.travel_destination &&
                              entry.activities_and_productivity?.phone_screen_on_hr &&
                              allAppsComplete &&
                              entry.activities_and_productivity?.app_usage_intent;
        
        return basicComplete && bodyComplete && mentalComplete && dietComplete && summaryComplete;
    }

    appendReason(id, text) {
        // Handle both ID styles (e.g., 'energy' -> 'energy-reason' OR direct ID)
        let field = document.getElementById(id);
        if (!field) field = document.getElementById(`${id}-reason`);
        if (!field) return;

        const current = field.value;
        if (current) {
            if (!current.includes(text)) {
                field.value = current + ", " + text;
            }
        } else {
            field.value = text;
        }
        field.dispatchEvent(new Event('input'));
    }

    // Basic Tab Helpers
    updateAQILabel(value, label) {
        label.className = '';
        if (value <= 50) {
            label.innerText = 'Good';
            label.classList.add('aqi-good');
        } else if (value <= 100) {
            label.innerText = 'Moderate';
            label.classList.add('aqi-moderate');
        } else if (value <= 150) {
            label.innerText = 'Unhealthy for Sensitive';
            label.classList.add('aqi-unhealthy-sensitive');
        } else if (value <= 200) {
            label.innerText = 'Unhealthy';
            label.classList.add('aqi-unhealthy');
        } else if (value <= 300) {
            label.innerText = 'Very Unhealthy';
            label.classList.add('aqi-very-unhealthy');
        } else {
            label.innerText = 'Hazardous';
            label.classList.add('aqi-hazardous');
        }
    }

    updateUVLabel(value, label) {
        label.className = '';
        if (value <= 2) {
            label.innerText = 'Low';
            label.classList.add('uv-low');
        } else if (value <= 5) {
            label.innerText = 'Moderate';
            label.classList.add('uv-moderate');
        } else if (value <= 7) {
            label.innerText = 'High';
            label.classList.add('uv-high');
        } else if (value <= 10) {
            label.innerText = 'Very High';
            label.classList.add('uv-very-high');
        } else {
            label.innerText = 'Extreme';
            label.classList.add('uv-extreme');
        }
    }

    async updateWeatherSuggestions() {
        const entries = await this.storage.getEntries();
        const weatherSet = new Set();
        const dietSuggestions = {
            'breakfast-list': new Set(),
            'lunch-list': new Set(),
            'dinner-list': new Set(),
            'snacks-list': new Set()
        };

        Object.values(entries).forEach(entry => {
            const weather = entry.environment?.weather_condition;
            if (weather) weatherSet.add(weather);

            // Collect diet suggestions
            if (entry.diet_and_nutrition) {
                const breakfast = entry.diet_and_nutrition.breakfast;
                const lunch = entry.diet_and_nutrition.lunch;
                const dinner = entry.diet_and_nutrition.dinner;
                const breakfastMeal = typeof breakfast === 'object' ? breakfast?.meal : breakfast;
                const lunchMeal = typeof lunch === 'object' ? lunch?.meal : lunch;
                const dinnerMeal = typeof dinner === 'object' ? dinner?.meal : dinner;

                if (breakfastMeal) dietSuggestions['breakfast-list'].add(breakfastMeal);
                if (lunchMeal) dietSuggestions['lunch-list'].add(lunchMeal);
                if (dinnerMeal) dietSuggestions['dinner-list'].add(dinnerMeal);
                if (entry.diet_and_nutrition.additional_items) dietSuggestions['snacks-list'].add(entry.diet_and_nutrition.additional_items);
            }
        });

        const datalist = document.getElementById('weather-suggestions');
        if (datalist) {
            weatherSet.forEach(weather => {
                if (!datalist.querySelector(`option[value="${weather}"]`)) {
                    const option = document.createElement('option');
                    option.value = weather;
                    datalist.appendChild(option);
                }
            });
        }

        // Populate diet suggestions
        Object.keys(dietSuggestions).forEach(listId => {
            const dl = document.getElementById(listId);
            if (dl) {
                dl.innerHTML = '';
                dietSuggestions[listId].forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    dl.appendChild(option);
                });
            }
        });

        // Personal Care Suggestions
        await this.updatePersonalCareSuggestions();
    }

    async updatePersonalCareSuggestions() {
        const entries = await this.storage.getEntries();
        const suggestions = {
            'face-name-list': new Set(),
            'face-brand-list': new Set(),
            'hair-name-list': new Set(),
            'hair-brand-list': new Set(),
            'hair-oil-list': new Set()
        };
        
        const appNames = new Set();
        
        Object.values(entries).forEach(entry => {
            const pc = entry.personal_care;
            if (pc) {
                if (pc.face_product_name) suggestions['face-name-list'].add(pc.face_product_name);
                if (pc.face_product_brand) suggestions['face-brand-list'].add(pc.face_product_brand);
                if (pc.hair_product_name) suggestions['hair-name-list'].add(pc.hair_product_name);
                if (pc.hair_product_brand) suggestions['hair-brand-list'].add(pc.hair_product_brand);
                if (pc.hair_oil) suggestions['hair-oil-list'].add(pc.hair_oil);
            }
            
            // Collect app names from most_used_apps
            const apps = entry.activities_and_productivity?.most_used_apps;
            if (apps && Array.isArray(apps)) {
                apps.forEach(app => {
                    if (app.name && app.name.trim()) appNames.add(app.name.trim());
                });
            }
        });
        
        Object.keys(suggestions).forEach(listId => {
            const datalist = document.getElementById(listId);
            if (datalist) {
                datalist.innerHTML = '';
                suggestions[listId].forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    datalist.appendChild(option);
                });
            }
        });
        
        // Populate app names
        const appDatalist = document.getElementById('app-names-list');
        if (appDatalist) {
            appDatalist.innerHTML = '';
            appNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                appDatalist.appendChild(option);
            });
        }
    }

    switchTab(tabId) {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.navItems.forEach(n => n.classList.remove('active'));

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.nav-item[data-target="${tabId}"]`).classList.add('active');

        if (tabId === 'tab-history') {
            const searchInput = document.getElementById('search-history');
            this.renderHistory(searchInput?.value || '', this.currentFilter || 'all'); // async, fire-and-forget
        }
    }

    changeDate(offset) {
        this.setDate(this.addDaysToDateKey(this.currentDate, offset));
    }

    setDate(dateStr) {
        const parsed = this.parseDateKey(dateStr);
        if (Number.isNaN(parsed.getTime())) return;
        this.currentDate = this.formatDateKey(parsed);
        this.loadEntry(this.currentDate);
        this.updateDateDisplay();
    }

    updateDateDisplay() {
        const d = this.parseDateKey(this.currentDate);
        if (Number.isNaN(d.getTime())) return;
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        this.dateDisplay.innerText = d.toLocaleDateString('en-US', options);
        this.weekdayDisplay.innerText = d.toLocaleDateString('en-US', { weekday: 'long' });

        // Day Counter
        if (this.dayCounter) {
            const diff = Math.ceil((d - this.referenceDate) / (1000 * 60 * 60 * 24));
            this.dayCounter.innerText = diff > 0 ? diff : '--';
        }

        this.hiddenDateInput.value = this.currentDate;
    }

    // -------------------------------------------------------------------------
    // DATA HANDLING
    // -------------------------------------------------------------------------

    initMultiSelectListeners() {
        const cancelBtn = document.getElementById('cancel-multi');
        const exportBtn = document.getElementById('export-multi');
        const deleteBtn = document.getElementById('delete-multi');

        if (cancelBtn) cancelBtn.addEventListener('click', () => this.exitMultiSelect());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportSelected());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelected());
    }

    initSearchListeners() {
        const searchInput = document.getElementById('search-history');
        const searchClear = document.getElementById('search-clear');
        const filterChips = document.querySelectorAll('.filter-chip');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (searchClear) searchClear.classList.toggle('hidden', !val);
                this.renderHistory(val, this.currentFilter || 'all');
            });
            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    searchInput.value = '';
                    searchClear.classList.add('hidden');
                    this.renderHistory('', this.currentFilter || 'all');
                });
            }
        }

        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                this.currentFilter = chip.dataset.filter || 'all';
                filterChips.forEach(item => item.classList.toggle('active', item === chip));
                this.renderHistory(searchInput?.value || '', this.currentFilter);
            });
        });
    }

    collectData() {
        const getVal = (id) => document.getElementById(id)?.value || "";
        const getNum = (id) => document.getElementById(id)?.value ? Number(document.getElementById(id).value) : null;

        // Mood Timeline - v4.2 stores one mood object per period
        const getMoodParams = (period) => {
            const container = document.getElementById(`${period}-moods`);
            const entries = container?.querySelectorAll('.mood-entry');
            const arr = [];
            if (entries) {
                entries.forEach(entry => {
                    arr.push({
                        mood_level: Number(entry.querySelector('.mood-slider')?.value) || 5,
                        mood_category: entry.querySelector('.mood-cat')?.value || "",
                        mood_feeling: entry.querySelector('.mood-feel')?.value || ""
                    });
                });
            }
            return arr;
        };

        // Apps
        const getApps = () => {
            const apps = [];
            document.querySelectorAll('.app-row').forEach((row, i) => {
                const name = row.querySelector('.app-name').value;
                const time = row.querySelector('.app-time').value;
                if (name || time) apps.push({ rank: i + 1, name, time });
            });
            return apps;
        };

        const d = this.parseDateKey(this.currentDate);
        const dayId = Number.isNaN(d.getTime()) ? 0 : Math.ceil((d - this.referenceDate) / (1000 * 60 * 60 * 24));

        return {
            version: "4.2",
            date: this.currentDate,
            day_id: dayId,
            weekday: Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString('en-US', { weekday: 'long' }),

            environment: {
                temperature_c: getVal('temp-min') && getVal('temp-max') ? `${getVal('temp-min')}-${getVal('temp-max')}` : "",
                air_quality_index: getNum('aqi'),
                humidity_percent: getNum('humidity'),
                uv_index: getNum('uv-index'),
                weather_condition: getVal('weather-condition'),
                environment_experience: getVal('env-experience')
            },

            body_measurements: {
                weight_kg: getNum('weight'),
                height_cm: getNum('height'),
                chest: getNum('chest'),
                belly: getNum('belly')
            },

            health_and_fitness: {
                sleep_hours: getVal('sleep-hours'),
                sleep_quality: getNum('sleep-quality'),
                sleep_quality_description: getVal('sleep-desc'),
                steps_count: getNum('steps-count'),
                steps_distance_km: getNum('distance-km'),
                kilocalorie: getNum('calories'),
                water_intake_liters: getNum('water-intake'),
                medications_taken: this.getPeriodObject('medications'),
                physical_symptoms: this.getPeriodObject('symptoms')
            },

            mental_and_emotional_health: {
                mental_state: getVal('mental-state'),
                mental_state_reason: getVal('mental-state-reason'),
                mood_timeline: {
                    morning: getMoodParams('morning'),
                    afternoon: getMoodParams('afternoon'),
                    evening: getMoodParams('evening'),
                    night: getMoodParams('night')
                },
                energy_level: getNum('energy-level'),
                energy_reason: getVal('energy-reason'),
                stress_level: getNum('stress-level'),
                stress_reason: getVal('stress-reason'),
                meditation_status: getVal('meditation-status') || "No",
                meditation_duration_min: getNum('meditation-duration') || 0
            },

            personal_care: {
                face_product_name: getVal('face-name'),
                face_product_brand: getVal('face-brand'),
                hair_product_name: getVal('hair-name'),
                hair_product_brand: getVal('hair-brand'),
                hair_oil: getVal('hair-oil'),
                skincare_routine: getVal('skincare-routine')
            },

            diet_and_nutrition: {
                breakfast: this.getMealEntry('breakfast'),
                lunch: this.getMealEntry('lunch'),
                dinner: this.getMealEntry('dinner'),
                additional_items: getVal('snacks')
            },

            activities_and_productivity: {
                tasks_today_english: getVal('tasks-completed'),
                travel_destination: getVal('travel-dest'),
                phone_screen_on_hr: getVal('screen-time'),
                most_used_apps: getApps(),
                app_usage_intent: getVal('app-usage-intent')
            },

            decisions: window.decisionsHandler ? window.decisionsHandler.collect() : [],

            additional_notes: {
                key_events: getVal('key-events'),
                other_note_status: getVal('other-notes-status')
            },

            daily_activity_summary: getVal('daily-summary'),
            overall_day_experience: getVal('overall-exp')
        };
    }

    async loadEntry(date) {
        this.resetForm();
        const data = await this.storage.getEntry(date);

        // Temporarily disable change tracking during load
        this.hasUnsavedChanges = false;

        if (!data) {
            // Only set defaults for new entries (not in history)
            const exists = await this.storage.hasEntry(date);
            if (!exists) {
                this.setDefaultValues();
            }
            this.lastSavedData = null;
            this.hasUnsavedChanges = false;
            this.updateTabIndicators();
            return;
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = (val === null || val === undefined) ? "" : val;
        };

        // Environment
        if (data.environment) {
            setVal('weather-condition', data.environment.weather_condition);

            // Handle Temp Split
            const rawTemp = data.environment.temperature_c || "";
            if (rawTemp.includes('-')) {
                const parts = rawTemp.split('-');
                setVal('temp-min', parts[0]);
                setVal('temp-max', parts[1]);
            } else {
                // Fallback if old data or different format
                setVal('temp-min', rawTemp);
            }

            setVal('aqi', data.environment.air_quality_index);
            setVal('humidity', data.environment.humidity_percent);
            setVal('uv-index', data.environment.uv_index);

            // Trigger visual updates for sliders
            document.getElementById('aqi')?.dispatchEvent(new Event('input'));
            document.getElementById('uv-index')?.dispatchEvent(new Event('input'));
            if (document.getElementById('humidity-value')) document.getElementById('humidity-value').innerText = data.environment.humidity_percent ?? 0;

            setVal('env-experience', data.environment.environment_experience);
        }

        // Body
        if (data.body_measurements) {
            setVal('weight', data.body_measurements.weight_kg);
            setVal('height', data.body_measurements.height_cm);
            setVal('chest', data.body_measurements.chest);
            setVal('belly', data.body_measurements.belly);
        }

        // Health (Body Tab Data Load)
        if (data.health_and_fitness) {
            setVal('sleep-hours', data.health_and_fitness.sleep_hours);
            setVal('sleep-quality', data.health_and_fitness.sleep_quality);
            // Trigger slider update
            document.getElementById('sleep-quality')?.dispatchEvent(new Event('input'));

            setVal('sleep-desc', data.health_and_fitness.sleep_quality_description);
            setVal('steps-count', data.health_and_fitness.steps_count);
            setVal('distance-km', data.health_and_fitness.steps_distance_km);
            setVal('calories', data.health_and_fitness.kilocalorie);
            setVal('water-intake', data.health_and_fitness.water_intake_liters);
            // Trigger hydration visual update
            const waterInput = document.getElementById('water-intake');
            if (waterInput) {
                waterInput.dispatchEvent(new Event('input'));
                // Force update glasses display
                const val = parseFloat(waterInput.value) || 0;
                const glassCount = Math.min(8, Math.floor(val / 0.25));
                const glasses = document.querySelectorAll('.glass-indicators i');
                glasses.forEach((glass, idx) => {
                    if (idx < glassCount) {
                        glass.className = 'fas fa-glass-water filled';
                        glass.style.color = '#3498db';
                        glass.style.transform = 'scale(1.2)';
                    } else {
                        glass.className = 'far fa-circle';
                        glass.style.color = '#ccc';
                        glass.style.transform = 'scale(1)';
                    }
                });
            }

            this.setPeriodObject('medications', data.health_and_fitness.medications_taken);
            this.setPeriodObject('symptoms', data.health_and_fitness.physical_symptoms);
        }

        // Mental
        if (data.mental_and_emotional_health) {
            setVal('mental-state', data.mental_and_emotional_health.mental_state);
            setVal('mental-state-reason', data.mental_and_emotional_health.mental_state_reason);

            setVal('energy-level', data.mental_and_emotional_health.energy_level);
            if (document.getElementById('energy-val')) {
                document.getElementById('energy-val').innerText = (data.mental_and_emotional_health.energy_level ?? 5);
            }
            setVal('energy-reason', data.mental_and_emotional_health.energy_reason);

            setVal('stress-level', data.mental_and_emotional_health.stress_level);
            if (document.getElementById('stress-val')) {
                document.getElementById('stress-val').innerText = (data.mental_and_emotional_health.stress_level ?? 5);
            }
            setVal('stress-reason', data.mental_and_emotional_health.stress_reason);

            setVal('meditation-status', data.mental_and_emotional_health.meditation_status || "No");
            setVal('meditation-duration', data.mental_and_emotional_health.meditation_duration_min || 0);

            // Timeline - Load arrays
            const tl = data.mental_and_emotional_health.mood_timeline;
            if (tl) {
                ['morning', 'afternoon', 'evening', 'night'].forEach(p => {
                    const container = document.getElementById(`${p}-moods`);
                    if (!container) return;
                    
                    const moodData = tl[p];
                    if (!moodData) return;
                    
                    // Handle both array and single object formats
                    const moodArray = Array.isArray(moodData) ? moodData : [moodData];
                    
                    // Clear existing entries
                    container.innerHTML = '';
                    
                    // Add entries from data
                    moodArray.forEach((mood, idx) => {
                        if (idx > 0) {
                            // Add new entry for additional moods
                            if (window.addPeriodMood) {
                                window.addPeriodMood(p);
                            }
                        } else {
                            // Create first entry
                            const entry = document.createElement('div');
                            entry.className = 'mood-entry';
                            entry.innerHTML = `
                                <button class="remove-mood-entry-btn" title="Remove"><i class="fas fa-times"></i></button>
                                <div class="slider-group">
                                    <div class="flex-between">
                                        <label>Mood Level</label>
                                        <span class="mood-val-display">5 ${this.getMoodEmoji(5)}</span>
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
                        }
                        
                        // Populate the entry
                        const entries = container.querySelectorAll('.mood-entry');
                        const entry = entries[idx];
                        if (entry) {
                            const slider = entry.querySelector('.mood-slider');
                            const valDisplay = entry.querySelector('.mood-val-display');
                            const catSelect = entry.querySelector('.mood-cat');
                            const feelSelect = entry.querySelector('.mood-feel');
                            
                            if (slider) slider.value = mood.mood_level || 5;
                            if (valDisplay) {
                                const emoji = this.getMoodEmoji(mood.mood_level || 5);
                                valDisplay.innerText = `${mood.mood_level || 5} ${emoji}`;
                            }
                            
                            if (catSelect) {
                                catSelect.value = mood.mood_category || "";
                                this.updateMoodFeelings(catSelect.value, feelSelect);
                            }
                            
                            if (feelSelect) {
                                feelSelect.value = mood.mood_feeling || "";
                            }
                        }
                    });
                });
            }
        }

        // Summary - Personal Care & Diet
        if (data.personal_care) {
            setVal('face-name', data.personal_care.face_product_name);
            setVal('face-brand', data.personal_care.face_product_brand);
            setVal('hair-name', data.personal_care.hair_product_name);
            setVal('hair-brand', data.personal_care.hair_product_brand);
            setVal('hair-oil', data.personal_care.hair_oil);
            setVal('skincare-routine', data.personal_care.skincare_routine);
        }

        if (data.diet_and_nutrition) {
            this.setMealEntry('breakfast', data.diet_and_nutrition.breakfast);
            this.setMealEntry('lunch', data.diet_and_nutrition.lunch);
            this.setMealEntry('dinner', data.diet_and_nutrition.dinner);
            setVal('snacks', data.diet_and_nutrition.additional_items);
        }

        // Activities
        if (data.activities_and_productivity) {
            setVal('tasks-completed', data.activities_and_productivity.tasks_today_english);
            setVal('travel-dest', data.activities_and_productivity.travel_destination);
            setVal('screen-time', data.activities_and_productivity.phone_screen_on_hr);
            setVal('app-usage-intent', data.activities_and_productivity.app_usage_intent);

            const apps = data.activities_and_productivity.most_used_apps;
            if (Array.isArray(apps)) {
                const rows = document.querySelectorAll('.app-row');
                rows.forEach((row, idx) => {
                    if (apps[idx]) {
                        row.querySelector('.app-name').value = apps[idx].name || "";
                        row.querySelector('.app-time').value = apps[idx].time || "";
                    }
                });
            }
        }

        // Additional Notes & Summary
        if (data.additional_notes) {
            setVal('key-events', data.additional_notes.key_events);
            setVal('other-notes-status', data.additional_notes.other_note_status || "No");
        }

        setVal('daily-summary', data.daily_activity_summary);
        setVal('overall-exp', data.overall_day_experience);

        // Decisions - Always load (even if empty array)
        if (window.decisionsHandler) {
            // Load decisions array, or empty array if not present
            const decisionsData = data.decisions || [];
            window.decisionsHandler.load(decisionsData);
        }

        // Update all counters
        document.querySelectorAll('textarea').forEach(el => {
            const countId = el.id + '-count';
            const counter = document.getElementById(countId);
            if (counter) counter.innerText = `(${el.value.length})`;
        });
        
        // Store loaded data and reset change flag
        this.lastSavedData = JSON.stringify(data);
        this.hasUnsavedChanges = false;
        this.updateTabIndicators();
    }

    resetForm() {
        // Disable change tracking during reset
        const wasTracking = this.hasUnsavedChanges;
        this.hasUnsavedChanges = false;
        
        document.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type !== 'date') el.value = "";
        });
        document.querySelectorAll('input[type="range"]').forEach(el => {
            el.value = (el.min == 1 || el.classList.contains('appetite-slider')) ? 5 : 0;
            const span = el.parentElement.querySelector('span') || document.getElementById(el.id.replace('level', 'val').replace('quality', 'qual-val').replace('index', 'val'));
            if (span) span.innerText = el.value;
        });
        document.querySelectorAll('.app-row input').forEach(el => el.value = "");
        
        // Clear decisions container
        if (window.decisionsHandler) {
            window.decisionsHandler.load([]);
        }
        
        this.setDefaultValues();
    }

    setDefaultValues() {
        const setIfEmpty = (id, val) => {
            const el = document.getElementById(id);
            if (el && !el.value) {
                el.value = val;
                // Don't trigger input event to avoid marking as changed
            }
        };
        setIfEmpty('temp-min', '15');
        setIfEmpty('temp-max', '25');
        setIfEmpty('aqi', '0');
        setIfEmpty('humidity', '0');
        setIfEmpty('uv-index', '0');
        setIfEmpty('weight', '72');
        setIfEmpty('height', '178');
        setIfEmpty('chest', '90');
        setIfEmpty('belly', '89');
        setIfEmpty('sleep-hours', '8:00');
        setIfEmpty('breakfast-appetite', '5');
        setIfEmpty('lunch-appetite', '5');
        setIfEmpty('dinner-appetite', '5');
        setIfEmpty('meditation-status', 'No');
        setIfEmpty('meditation-duration', '0');
        setIfEmpty('other-notes-status', 'No');
        
        // Manually update displays without triggering events
        const aqiEl = document.getElementById('aqi');
        if (aqiEl) {
            document.getElementById('aqi-value').innerText = aqiEl.value;
            this.updateAQILabel(parseInt(aqiEl.value), document.getElementById('aqi-label'));
        }
        const uvEl = document.getElementById('uv-index');
        if (uvEl) {
            document.getElementById('uv-value').innerText = uvEl.value;
            this.updateUVLabel(parseInt(uvEl.value), document.getElementById('uv-label'));
        }
        const humidityEl = document.getElementById('humidity');
        if (humidityEl && document.getElementById('humidity-value')) {
            document.getElementById('humidity-value').innerText = humidityEl.value;
        }
        ['breakfast', 'lunch', 'dinner'].forEach(mealId => {
            const appetiteEl = document.getElementById(`${mealId}-appetite`);
            const appetiteDisplay = document.getElementById(`${mealId}-appetite-value`);
            if (appetiteEl && appetiteDisplay) appetiteDisplay.innerText = appetiteEl.value;
        });
    }

    async saveEntry(showToast = false) {
        const data = this.collectData();
        const res  = await this.storage.saveEntry(this.currentDate, data);
        if (res.success) {
            this.hasUnsavedChanges = false;
            this.lastSavedData = JSON.stringify(data);
            if (showToast) {
                this.showToast('Saved Successfully ✓');
            }
        }
        // Refresh history if on history tab
        const historyTab = document.getElementById('tab-history');
        if (historyTab && historyTab.classList.contains('active')) {
            this.renderHistory('', 'all'); // async, fire-and-forget
        }
    }

    showToast(msg) {
        this.toast.innerText = msg;
        this.toast.classList.remove('hidden');
        setTimeout(() => this.toast.classList.add('hidden'), 2000);
    }

    // -------------------------------------------------------------------------
    // HISTORY & MULTI-SELECT
    // -------------------------------------------------------------------------

    // Helper for Syntax Highlighting
    syntaxHighlight(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    async renderHistory(searchTerm = "", filterMood = "all") {
        this.currentFilter = filterMood;
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', (chip.dataset.filter || 'all') === filterMood);
        });

        const list = document.getElementById('history-list');
        list.innerHTML = "";
        const entries = await this.storage.getEntries();
        let sortedDates = Object.keys(entries).sort((a, b) => {
            const timeA = this.getEntrySortTime(a, entries[a]);
            const timeB = this.getEntrySortTime(b, entries[b]);
            if (timeA !== timeB) return timeB - timeA; // Newest first
            return b.localeCompare(a);
        });

        // Filter Logic
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            sortedDates = sortedDates.filter(date => {
                const entry = entries[date];
                const text = JSON.stringify(entry).toLowerCase();
                return text.includes(lower);
            });
        }

        if (filterMood !== "all") {
            sortedDates = sortedDates.filter(date => {
                const entry = entries[date];
                const moodScore = this.getEntryMoodScore(entry);
                if (filterMood === 'happy' && moodScore >= 7) return true;
                if (filterMood === 'week') {
                    const entryTime = this.getEntrySortTime(date, entry);
                    if (!Number.isFinite(entryTime)) return false;
                    const now = this.parseDateKey(this.formatDateKey(new Date()));
                    if (Number.isNaN(now.getTime())) return false;
                    const diffTime = Math.abs(now.getTime() - entryTime);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= 7;
                }
                if (filterMood === 'complete') {
                    return this.isEntryComplete(entry);
                }
                return false;
            });
        }

        if (sortedDates.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open" style="font-size:3rem; color:var(--text-secondary); margin-bottom:1rem;"></i>
                    <h3>No entries found</h3>
                    <p>Try adjusting filters or add a new entry.</p>
                </div>`;
            return;
        }

        sortedDates.forEach(date => {
            const entry = entries[date];
            const div = document.createElement('div');
            div.className = `history-card ${this.selectedEntries.has(date) ? 'selected' : ''} ${this.multiSelectMode ? 'multi-mode' : ''}`;
            div.dataset.date = date;

            // Mood & Summary
            const moodScore = this.getEntryMoodScore(entry);
            const moodEmoji = this.getMoodEmoji(moodScore);

            const summary = String(entry.daily_activity_summary || entry.additional_notes?.key_events || "No summary provided...");

            // Check status - comprehensive validation
            const isComplete = this.isEntryComplete(entry);
            const statusHtml = isComplete
                ? `<span class="entry-status status-complete"><i class="fas fa-check-circle"></i> Complete</span>`
                : `<span class="entry-status status-incomplete"><i class="fas fa-exclamation-circle"></i> Incomplete</span>`;

            div.innerHTML = `
                <div class="select-checkbox"></div>
                
                <div class="entry-header">
                    <div class="date-badge"><i class="fas fa-calendar-alt"></i> ${date}</div>
                    <div class="mood-indicator" title="Mood Level: ${moodScore}">${moodEmoji}</div>
                </div>
                
                <div class="entry-preview">${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}</div>
                ${statusHtml}
                
                <div class="action-row">
                    <button class="icon-action-btn edit-btn" onclick="if(window.app && window.app.ui) { window.app.ui.loadHistory('${date}'); }" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="icon-action-btn download-btn" onclick="if(window.app && window.app.ui) { window.app.ui.exportOne('${date}'); }" title="Export JSON"><i class="fas fa-download"></i></button>
                    <button class="icon-action-btn expand-btn" title="View Data"><i class="fas fa-code"></i></button>
                    <button class="icon-action-btn delete-btn" onclick="if(window.app && window.app.ui) { window.app.ui.deleteOne('${date}'); }" title="Delete"><i class="fas fa-trash"></i></button>
                </div>

                <div class="expanded-view">
                    <div class="json-header">
                        <button class="copy-json-btn" title="Copy JSON">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <pre class="json-content">${this.syntaxHighlight(entry)}</pre>
                </div>
            `;

            // Expand Toggle
            div.querySelector('.expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const view = div.querySelector('.expanded-view');
                view.classList.toggle('show');
            });

            // Copy JSON Button
            div.querySelector('.copy-json-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const jsonText = JSON.stringify(entry, null, 2);
                navigator.clipboard.writeText(jsonText).then(() => {
                    const btn = e.currentTarget;
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => btn.innerHTML = originalHTML, 1500);
                }).catch(() => alert('Failed to copy'));
            });

            // Card Click (Selection or Edit)
            div.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('.expanded-view')) return;

                if (this.multiSelectMode) {
                    this.toggleSelection(date, div);
                } else {
                    // Open edit (default action)
                    this.loadHistory(date);
                }
            });

            // Long Press
            div.addEventListener('mousedown', () => {
                this.longPressTimer = setTimeout(() => this.enterMultiSelect(date, div), 600);
            });
            div.addEventListener('touchstart', () => {
                this.longPressTimer = setTimeout(() => this.enterMultiSelect(date, div), 600);
            }, { passive: true });
            ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(evt => {
                div.addEventListener(evt, () => clearTimeout(this.longPressTimer));
            });

            list.appendChild(div);
        });
    }

    enterMultiSelect(initialDate, element) {
        if (this.multiSelectMode) return;
        this.multiSelectMode = true;

        if (this.multiHeader) {
            this.multiHeader.classList.remove('hidden');
        }

        // Shift UI
        document.querySelectorAll('.history-card').forEach(el => el.classList.add('multi-mode'));

        if (navigator.vibrate) navigator.vibrate(50);

        this.toggleSelection(initialDate, element);
    }

    exitMultiSelect() {
        this.multiSelectMode = false;
        this.selectedEntries.clear();

        if (this.multiHeader) {
            this.multiHeader.classList.add('hidden');
        }

        // Reset UI
        document.querySelectorAll('.history-card').forEach(el => {
            el.classList.remove('multi-mode', 'selected');
        });
        this.updateSelectionUI();
    }

    toggleSelection(date, element) {
        if (this.selectedEntries.has(date)) {
            this.selectedEntries.delete(date);
            element.classList.remove('selected');
        } else {
            this.selectedEntries.add(date);
            this.markSelected(element, true);
        }
        this.updateSelectionUI();
    }

    markSelected(element, isSelected) {
        if (isSelected) {
            element.classList.add('selected');
        } else {
            element.classList.remove('selected');
        }
    }

    updateSelectionUI() {
        const count = this.selectedEntries.size;
        if (this.selectionCount) this.selectionCount.innerText = `${count} selected`;
        if (this.exportMultiBtn) this.exportMultiBtn.disabled = count === 0;
        if (this.deleteMultiBtn) this.deleteMultiBtn.disabled = count === 0;
    }

    // -------------------------------------------------------------------------
    // EXPORT / IMPORT / HELPERS
    // -------------------------------------------------------------------------

    loadHistory(date) {
        console.log('Loading history for date:', date);
        
        // Disable unsaved changes check temporarily
        const originalFlag = this.hasUnsavedChanges;
        this.hasUnsavedChanges = false;
        
        // Set the current date to the selected date
        this.currentDate = date;
        
        // Load the entry data
        this.loadEntry(date);
        
        // Update the date display at top
        this.updateDateDisplay();
        
        // Switch to Basic tab (home)
        this.switchTab('tab-basic');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log('History loaded and switched to Basic tab');
    }

    async exportOne(date) {
        const json = await this.storage.exportEntry(date);
        if (json) this.storage.downloadJSON(`${date}.json`, json);
    }

    async exportEntry() {
        await this.saveEntry();
        await this.exportOne(this.currentDate);
    }

    async shareEntry() {
        await this.saveEntry();
        const json = await this.storage.exportEntry(this.currentDate);
        if (!json) { this.showToast('No data to share'); return; }
        if (navigator.share) {
            navigator.share({
                title: `Diary Entry - ${this.currentDate}`,
                text: json
            }).catch(() => this.showToast('Share cancelled'));
        } else {
            navigator.clipboard.writeText(json);
            this.showToast('Copied to clipboard');
        }
    }

    async exportSelected() {
        const dates = Array.from(this.selectedEntries);
        const data  = await Promise.all(dates.map(d => this.storage.getEntry(d)));
        this.storage.downloadJSON(`diary_export_${dates.length}.json`, JSON.stringify(data, null, 2));
        this.exitMultiSelect();
    }

    async deleteOne(date) {
        if (confirm('Delete this entry?')) {
            await this.storage.deleteEntry(date);
            this.renderHistory('', 'all'); // async, fire-and-forget
            if (date === this.currentDate) this.resetForm();
        }
    }

    async deleteSelected() {
        if (confirm(`Delete ${this.selectedEntries.size} entries?`)) {
            await Promise.all(Array.from(this.selectedEntries).map(d => this.storage.deleteEntry(d)));
            this.exitMultiSelect();
            this.renderHistory('', 'all'); // async, fire-and-forget
        }
    }

    async createBackup() {
        const all = await this.storage.getEntries();
        // Rebuild as a flat object keyed by date — data is NOT modified
        const normalizedBackup = {};
        Object.keys(all).forEach(dateKey => {
            normalizedBackup[dateKey] = { ...(all[dateKey] || {}), date: dateKey };
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.storage.downloadJSON(`diary-backup-${stamp}.json`, JSON.stringify(normalizedBackup, null, 2));
        this.showToast(`Backup created — ${Object.keys(all).length} entries`);
    }

    handleFileImport(e, isBackup) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const content = evt.target.result;
            const res = await this.storage.importEntries(content);
            if (res.success) {
                this.showToast(`Imported ${res.count} entries ✓`);
                await this.loadEntry(this.currentDate);
                const historyTab = document.getElementById('tab-history');
                if (historyTab && historyTab.classList.contains('active')) {
                    this.renderHistory('', 'all'); // async, fire-and-forget
                }
                // Refresh autocomplete suggestions
                this.updateWeatherSuggestions();
            } else {
                alert('Import Failed: ' + res.error);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    async clearForm() {
        if (confirm('Clear current form and delete saved data?')) {
            await this.storage.deleteEntry(this.currentDate);
            this.resetForm();
            const historyTab = document.getElementById('tab-history');
            if (historyTab && historyTab.classList.contains('active')) {
                this.renderHistory('', 'all');
            }
        }
    }

    async importLastDayData(section) {
        const prevDate = this.addDaysToDateKey(this.currentDate, -1);
        const prevData = await this.storage.getEntry(prevDate);

        if (!prevData) {
            this.showToast('No data for previous day');
            return;
        }

        if (section === 'environment') {
            if (prevData.environment) {
                document.getElementById('weather-condition').value = prevData.environment.weather_condition || "";

                const temp = prevData.environment.temperature_c || "";
                if (temp.includes('-')) {
                    const parts = temp.split('-');
                    document.getElementById('temp-min').value = parts[0];
                    document.getElementById('temp-max').value = parts[1];
                } else {
                    document.getElementById('temp-min').value = temp;
                }

                document.getElementById('aqi').value = prevData.environment.air_quality_index ?? 0;
                document.getElementById('humidity').value = prevData.environment.humidity_percent ?? 0;
                document.getElementById('uv-index').value = prevData.environment.uv_index ?? 0;
                document.getElementById('env-experience').value = prevData.environment.environment_experience || "";

                document.getElementById('aqi').dispatchEvent(new Event('input'));
                document.getElementById('uv-index').dispatchEvent(new Event('input'));
                document.getElementById('humidity').dispatchEvent(new Event('input'));

                this.showToast('Environment data imported');
            }
        } else if (section === 'personal_care') {
            const pc = prevData.personal_care;

            if (pc) {
                document.getElementById('face-name').value = pc.face_product_name || "";
                document.getElementById('face-brand').value = pc.face_product_brand || "";
                document.getElementById('hair-name').value = pc.hair_product_name || "";
                document.getElementById('hair-brand').value = pc.hair_product_brand || "";
                document.getElementById('hair-oil').value = pc.hair_oil || "";
                document.getElementById('skincare-routine').value = pc.skincare_routine || "";
                this.showToast('Personal Care data imported');
            }
        }
        this.updateTabIndicators();
    }

    async hardRefresh() {
        if (confirm('Clear cache and reload? This will fetch the latest version.')) {
            try {
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // Unregister service workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(reg => reg.unregister()));
                }
                
                // Hard reload
                window.location.reload(true);
            } catch (err) {
                console.error('Hard refresh error:', err);
                // Fallback to simple reload
                window.location.reload(true);
            }
        }
    }

    updateTabIndicators() {
        const data = this.collectData();
        
        // Check Basic tab - ALL fields required
        const basicComplete = data.environment.temperature_c && 
                            data.environment.weather_condition && 
                            data.environment.air_quality_index !== null &&
                            data.environment.humidity_percent !== null &&
                            data.environment.uv_index !== null &&
                            data.environment.environment_experience;
        document.querySelector('[data-target="tab-basic"]')?.classList.toggle('incomplete', !basicComplete);
        
        // Check Body tab - ALL fields required
        const bodyComplete = data.body_measurements.weight_kg && 
                           data.body_measurements.height_cm && 
                           data.body_measurements.chest && 
                           data.body_measurements.belly &&
                           data.health_and_fitness.sleep_hours && 
                           data.health_and_fitness.sleep_quality !== null &&
                           data.health_and_fitness.sleep_quality_description &&
                           data.health_and_fitness.steps_count !== null &&
                           data.health_and_fitness.steps_distance_km !== null &&
                           data.health_and_fitness.kilocalorie !== null &&
                           data.health_and_fitness.water_intake_liters !== null &&
                           this.hasPeriodObject(data.health_and_fitness.medications_taken) &&
                           this.hasPeriodObject(data.health_and_fitness.physical_symptoms);
        document.querySelector('[data-target="tab-body"]')?.classList.toggle('incomplete', !bodyComplete);
        
        // Check Mental tab - ALL fields required
        const allMoodTimelinesComplete = ['morning', 'afternoon', 'evening', 'night'].every(period => {
            const timeline = data.mental_and_emotional_health.mood_timeline[period];
            if (Array.isArray(timeline)) {
                return timeline.length > 0 && timeline.every(m => m.mood_category && m.mood_feeling);
            }
            return timeline && timeline.mood_category && timeline.mood_feeling;
        });
        const mentalComplete = data.mental_and_emotional_health.mental_state && 
                             data.mental_and_emotional_health.mental_state_reason &&
                             allMoodTimelinesComplete &&
                             data.mental_and_emotional_health.energy_level !== null &&
                             data.mental_and_emotional_health.energy_reason &&
                             data.mental_and_emotional_health.stress_level !== null &&
                             data.mental_and_emotional_health.stress_reason &&
                             data.mental_and_emotional_health.meditation_status &&
                             data.mental_and_emotional_health.meditation_duration_min !== null;
        document.querySelector('[data-target="tab-mental"]')?.classList.toggle('incomplete', !mentalComplete);
        
        // Check Diet tab - ALL fields required
        const dietComplete = this.isMealEntryComplete(data.diet_and_nutrition.breakfast) &&
                           this.isMealEntryComplete(data.diet_and_nutrition.lunch) &&
                           this.isMealEntryComplete(data.diet_and_nutrition.dinner) &&
                           data.diet_and_nutrition.additional_items &&
                           data.personal_care.face_product_name &&
                           data.personal_care.face_product_brand &&
                           data.personal_care.hair_product_name &&
                           data.personal_care.hair_product_brand &&
                           data.personal_care.hair_oil &&
                           data.personal_care.skincare_routine;
        document.querySelector('[data-target="tab-diet"]')?.classList.toggle('incomplete', !dietComplete);
        
        // Check Summary tab - ALL fields required
        const allAppsComplete = data.activities_and_productivity.most_used_apps && 
                              data.activities_and_productivity.most_used_apps.length === 5 &&
                              data.activities_and_productivity.most_used_apps.every(app => app.name && app.time);
        const summaryComplete = data.additional_notes.key_events &&
                              data.daily_activity_summary && 
                              data.overall_day_experience &&
                              data.additional_notes.other_note_status &&
                              data.activities_and_productivity.tasks_today_english &&
                              data.activities_and_productivity.travel_destination &&
                              data.activities_and_productivity.phone_screen_on_hr &&
                              allAppsComplete &&
                              data.activities_and_productivity.app_usage_intent;
        document.querySelector('[data-target="tab-summary"]')?.classList.toggle('incomplete', !summaryComplete);
    }
}
