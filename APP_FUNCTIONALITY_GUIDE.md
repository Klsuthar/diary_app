# 📖 My Personal Diary — Complete Functionality Guide

> **Version:** 4.2  
> **Platform:** Progressive Web App (PWA) — Mobile-First  
> **Storage Engine:** IndexedDB (Browser Database)  
> **Data Format:** JSON (v4.2 Schema)

---

## 📱 App Overview

My Personal Diary is a comprehensive daily life tracking app that captures everything about your day — from weather and body measurements to mood, diet, activities, and decisions. It runs entirely in your browser, stores data locally on your device using IndexedDB, and supports full JSON backup/restore.

### Key Highlights
- 🔒 **100% Offline** — No server, no internet required after first load
- 📦 **IndexedDB Storage** — Reliable, large-capacity local database
- 📤 **JSON Backup/Restore** — Export and import your entire diary anytime
- 📱 **PWA Installable** — Install on phone homescreen like a native app
- 🔄 **Auto-Save** — Data saves automatically as you type (debounced 500ms)
- 🎨 **Dark Theme** — Premium dark UI with glassmorphism effects

---

## 🗂️ File Structure

```
diary_app/
├── index.html              → Main HTML (all 7 tabs)
├── manifest.json           → PWA manifest (name, icons, theme)
├── sw.js                   → Service Worker (offline caching)
├── css/
│   └── style.css           → All styling (dark theme, responsive)
├── js/
│   ├── storage.js          → IndexedDB engine (CRUD, import/export)
│   ├── ui.js               → Main UI class (forms, events, rendering)
│   ├── mood-handler.js     → Mood timeline add/remove logic
│   ├── decisions-handler.js→ Decisions JSON add/edit/drag-drop
│   └── app.js              → Bootstrap (init storage → init UI)
├── images/
│   ├── logo256.png         → PWA icon (192x192)
│   └── logo512.png         → PWA icon (512x512)
├── v4.2.json               → Data schema reference (output format)
└── BASIC_TAB_UI_GUIDE.md   → Body tab UI design guide
```

---

## ⚙️ Architecture & Data Flow

### Initialization Flow
```
Browser Loads index.html
    ↓
DOMContentLoaded fires (app.js)
    ↓
new Storage() → IndexedDB opens ("diary_app_db")
    ↓
await storage._dbPromise (DB ready)
    ↓
new UI(storage) → Constructor runs:
    ├── initElements()        → Cache DOM references
    ├── initEventListeners()  → Wire all buttons/sliders/inputs
    └── async IIFE:
        ├── await loadEntry(today)         → Load today's data from DB
        ├── updateDateDisplay()            → Show current date in header
        └── await updateWeatherSuggestions() → Populate autocomplete lists
```

### Data Save Flow
```
User types/changes any input
    ↓
'input' event fires → hasUnsavedChanges = true
    ↓
debouncedSave() called (500ms delay)
    ↓
collectData() → Reads ALL form fields into v4.2 JSON object
    ↓
await storage.saveEntry(dateKey, data) → IndexedDB put()
    ↓
hasUnsavedChanges = false
```

### Storage Engine (IndexedDB)
```
Database: "diary_app_db" (version 1)
Object Store: "entries"
    ├── keyPath: "date" (e.g. "2026-05-20")
    ├── Each record: Full v4.2 JSON object
    └── No indexes (simple key-value by date)

All methods are async (return Promises):
    ├── saveEntry(date, data)    → put()
    ├── getEntry(date)           → get()
    ├── getEntries()             → getAll() → { "date": {...}, ... }
    ├── hasEntry(date)           → getEntry() !== null
    ├── deleteEntry(date)        → delete()
    ├── clearAll()               → clear()
    ├── exportEntry(date)        → JSON.stringify(entry)
    └── importEntries(json)      → Parse & saveEntry() for each
```

---

## 🧭 Navigation System

### Bottom Navigation Bar (7 Tabs)
| # | Tab | Icon | ID | Content |
|---|------|------|----|---------|
| 1 | **Basic** | 🏠 `fa-home` | `tab-basic` | Environment (weather, temp, AQI, humidity, UV) |
| 2 | **Body** | 💪 `fa-dumbbell` | `tab-body` | Measurements, Sleep, Activity, Hydration, Medications, Symptoms |
| 3 | **Mental** | 🧠 `fa-brain` | `tab-mental` | Mental State, Mood Timeline (4 periods), Energy, Stress, Meditation |
| 4 | **Diet** | 🍽️ `fa-utensils` | `tab-diet` | Breakfast/Lunch/Dinner + Appetite, Snacks, Personal Care |
| 5 | **Summary** | 📋 `fa-clipboard-list` | `tab-summary` | Key Events, Activity Summary, Tasks, Travel, Screen Time, Apps |
| 6 | **Decisions** | 💡 `fa-lightbulb` | `tab-decisions` | JSON-based decisions log with drag-drop reordering |
| 7 | **History** | 📕 `fa-book` | `tab-history` | All saved entries, search, filter, multi-select, export/delete |

### Tab Switching
- Click bottom nav button → `switchTab(tabId)`
- Active tab gets `active` class
- History tab auto-renders entry list on switch
- **Tab completion indicators** — Each tab shows incomplete dot if fields are missing

### Header Bar
- **Date Controls:** ← Previous | Date Display | Next →
- **Date Picker:** Click date to open native date picker
- **Day Counter:** Shows days since July 4, 2003 (reference date)
- **Save Button:** Manual save with toast notification
- **Export Button:** Download current entry as JSON
- **Menu (⋮):** Share, Export, Import, Clear, Backup, Restore, Hard Refresh

---

## 📝 Tab-by-Tab Functionality

### Tab 1: 🏠 Basic (Environment)

| Field | Input Type | ID | Default | Range/Options |
|-------|------------|-----|---------|---------------|
| Temperature Min | `number` | `temp-min` | 15 | -10 to 60 °C |
| Temperature Max | `number` | `temp-max` | 25 | -10 to 60 °C |
| Weather Condition | `text` + datalist | `weather-condition` | (empty) | Sunny, Cloudy, Rainy, Stormy, Snowy, Windy, Foggy + past entries |
| AQI | `range` slider | `aqi` | 0 | 0-300 (Good/Moderate/Unhealthy/Hazardous) |
| Humidity | `range` slider | `humidity` | 0 | 0-100% |
| UV Index | `range` slider | `uv-index` | 0 | 0-12 (Low/Moderate/High/Very High/Extreme) |
| Environment Experience | `textarea` | `env-experience` | (empty) | Free text |

**Special Features:**
- "Import Last" button copies previous day's environment data
- AQI slider shows color-coded labels (green → red)
- UV slider shows risk level labels
- Weather suggestions auto-populated from past entries

---

### Tab 2: 💪 Body

#### Body Measurements Card
| Field | ID | Default | Unit |
|-------|----|---------|------|
| Weight | `weight` | 72 | kg |
| Height | `height` | 178 | cm |
| Chest | `chest` | 90 | cm |
| Belly | `belly` | 89 | cm |

- **BMI Auto-Calculation:** Shows BMI value + category (Underweight/Normal/Overweight/Obese) when weight & height are filled

#### Sleep Card
| Field | ID | Default | Format |
|-------|----|---------|--------|
| Duration | `sleep-hours` | 8:00 | HH:MM text |
| Quality | `sleep-quality` | 5 | Slider 1-10 |
| Description | `sleep-desc` | (empty) | Textarea (200 char) |

- Quality slider emoji: 1-2 Terrible 😢, 3-4 Poor 😔, 5-6 Average 😐, 7-8 Good 😊, 9-10 Excellent 🌟

#### Activity Card (3-column row)
| Field | ID | Unit |
|-------|----|------|
| Steps | `steps-count` | steps |
| Distance | `distance-km` | km |
| Calories | `calories` | kcal |

#### Hydration Card
| Field | ID | Default | Unit |
|-------|----|---------|------|
| Water Intake | `water-intake` | 0.0 | Liters |

- 8 glass indicators (filled/empty based on 0.25L each)
- Quick add buttons: +0.25L, +0.5L, +1L

#### Medications Card (4-period grid)
| Period | ID | Default |
|--------|----|---------|
| Morning | `medications-morning` | No |
| Afternoon | `medications-afternoon` | No |
| Evening | `medications-evening` | No |
| Night | `medications-night` | No |

#### Physical Symptoms Card (4-period grid)
| Period | ID | Default |
|--------|----|---------|
| Morning | `symptoms-morning` | No |
| Afternoon | `symptoms-afternoon` | No |
| Evening | `symptoms-evening` | No |
| Night | `symptoms-night` | No |

---

### Tab 3: 🧠 Mental

#### Mental State Card
| Field | ID | Description |
|-------|----|-------------|
| Overall State | `mental-state` | Text input (e.g. Positive, Calm, Anxious) |
| Reason | `mental-state-reason` | Textarea (500 char limit) |

#### Mood Timeline (4 Time Periods)
Each period (Morning 6-12, Afternoon 12-4, Evening 4-9, Night 9-6) has:

| Field | Class | Options |
|-------|-------|---------|
| Mood Level | `.mood-slider` | Range 1-10 with emoji |
| Category | `.mood-cat` | positive_high_energy, neutral_balanced, low_energy_tired, negative_heavy, cognitive |
| Feeling | `.mood-feel` | Depends on category (e.g. happy, calm, motivated for positive) |

**Special Features:**
- **Multiple moods per period** — Click ➕ to add more mood entries in any period
- **Remove mood** — Click ✕ on any mood entry (minimum 1 per period)
- **Category → Feeling cascade** — Selecting category populates feeling dropdown
- **Mood Categories & Feelings:**
  - `positive_high_energy`: happy, calm, peaceful, relaxed, content, motivated, energetic, confident, hopeful, satisfied
  - `neutral_balanced`: neutral, normal, stable, okay, composed, indifferent
  - `low_energy_tired`: tired, sleepy, exhausted, lazy, drained, dull
  - `negative_heavy`: stressed, anxious, irritated, frustrated, overwhelmed, sad, low, lonely, bored
  - `cognitive`: focused, distracted, confused, overthinking, mentally_heavy, mentally_clear

#### Energy Card
| Field | ID | Range |
|-------|----|-------|
| Energy Level | `energy-level` | Slider 0-10 |
| Energy Reason | `energy-reason` | Textarea (300 char) |

#### Stress Card
| Field | ID | Range |
|-------|----|-------|
| Stress Level | `stress-level` | Slider 0-10 |
| Stress Reason | `stress-reason` | Textarea (300 char) |

#### Meditation Card
| Field | ID | Default |
|-------|----|---------|
| Type/Name | `meditation-status` | No |
| Duration | `meditation-duration` | 0 minutes |

---

### Tab 4: 🍽️ Diet

#### Diet & Nutrition Card
Each meal (Breakfast, Lunch, Dinner) has:

| Field | ID Pattern | Type |
|-------|------------|------|
| Meal | `breakfast`, `lunch`, `dinner` | Text + datalist (auto-suggestions from past) |
| Appetite | `{meal}-appetite` | Slider 0-10 |

| Field | ID | Type |
|-------|----|------|
| Snacks | `snacks` | Text + datalist |

#### Personal Care Card
| Field | ID | Type |
|-------|----|------|
| Face Product | `face-name` | Text + datalist |
| Face Brand | `face-brand` | Text + datalist |
| Hair Product | `hair-name` | Text + datalist |
| Hair Brand | `hair-brand` | Text + datalist |
| Hair Oil | `hair-oil` | Text + datalist |
| Skincare Routine | `skincare-routine` | Textarea |

- "Import Last" button copies previous day's personal care data
- All fields have autocomplete from past entries

---

### Tab 5: 📋 Summary

#### Daily Summary Card
| Field | ID | Type |
|-------|----|------|
| Key Events | `key-events` | Textarea |
| Activity Summary | `daily-summary` | Textarea (9 rows) with fullscreen toggle |
| Overall Experience | `overall-exp` | Textarea |
| Other Notes? | `other-notes-status` | Select (No/Yes), default: No |

- **Fullscreen Mode:** Activity Summary textarea can expand to fullscreen with back-button support

#### Activities & Productivity Card
| Field | ID | Type |
|-------|----|------|
| Tasks Completed | `tasks-completed` | Textarea |
| Travel Destination | `travel-dest` | Text + suggestion chips (School, Village, Home, Farm) |
| Screen Time | `screen-time` | Text (e.g. "1h20m" or "80m") |
| App Usage Intent | `app-usage-intent` | Textarea |

#### Top 5 Apps Used
| Rank | App Name | App Time |
|------|----------|----------|
| 1-5 | `.app-name` (text + datalist) | `.app-time` (text e.g. "1h20m") |

- App names auto-populated from past entries
- Validation: Total app time cannot exceed screen time

---

### Tab 6: 💡 Decisions

| Feature | Description |
|---------|-------------|
| JSON Input | Paste any JSON object/array in textarea |
| Add JSON | Parse and add to decisions list |
| Decision Items | Expandable cards with JSON preview |
| Edit | Inline JSON editor per decision |
| Remove | Delete individual decisions |
| Drag & Drop | Long-press number → drag to reorder |
| Per-Date | Decisions are saved per date entry |

---

### Tab 7: 📕 History

| Feature | Description |
|---------|-------------|
| Entry List | All saved entries sorted newest-first |
| Search | Real-time text search across all entry data |
| Filter Chips | All, This Week, Good Mood (≥7), Complete |
| Entry Card | Shows date, mood emoji, summary preview, status |
| Actions | Edit (load entry), Export JSON, View JSON, Delete |
| Multi-Select | Long-press to enter multi-select mode |
| Bulk Export | Export selected entries as JSON array |
| Bulk Delete | Delete multiple entries at once |
| JSON Viewer | Syntax-highlighted JSON with copy button |

---

## 💾 Backup & Restore System

### Create Backup (Export All)
```
Menu (⋮) → Create Backup
    ↓
storage.getEntries() → Get ALL entries from IndexedDB
    ↓
Build object: { "2026-05-20": {...}, "2026-05-19": {...}, ... }
    ↓
Download as: diary-backup-2026-05-20T21-08-02-000Z.json
```

**Backup Format:**
```json
{
  "2026-05-20": {
    "version": "4.2",
    "date": "2026-05-20",
    "day_id": 8356,
    "weekday": "Wednesday",
    "environment": { ... },
    "body_measurements": { ... },
    "health_and_fitness": { ... },
    "mental_and_emotional_health": { ... },
    "personal_care": { ... },
    "diet_and_nutrition": { ... },
    "activities_and_productivity": { ... },
    "decisions": [],
    "additional_notes": { ... },
    "daily_activity_summary": "...",
    "overall_day_experience": "..."
  },
  "2026-05-19": { ... }
}
```

### Restore Backup (Import)
```
Menu (⋮) → Restore Backup → Select JSON file
    ↓
FileReader reads file as text
    ↓
storage.importEntries(jsonContent)
    ↓
Detects format:
    ├── Bulk object { "date": {...}, ... } → Save each entry
    ├── Array [ {...}, {...} ]             → Save each with item.date
    └── Single { date: "...", version: "4.2" } → Save one entry
    ↓
Toast: "Imported X entries ✓"
```

### Import Single Entry
```
Menu (⋮) → Import JSON → Select .json file
    ↓
Same importEntries() logic as backup restore
```

### Export Single Entry
```
Menu (⋮) → Export Entry  OR  Export button (header)
    ↓
saveEntry() first → Then download current date as YYYY-MM-DD.json
```

### Share Entry
```
Menu (⋮) → Share Entry
    ↓
If Web Share API available → Native share dialog (WhatsApp, etc.)
Else → Copy JSON to clipboard
```

> **⚠️ IMPORTANT:** Backup and Restore do NOT modify data in any way. JSON goes in and comes out exactly as-is. No fields are added, removed, or transformed.

---

## 🔧 Smart Features

### Auto-Save (Debounced)
- Every input/slider/select change triggers `debouncedSave()` with 500ms delay
- Prevents excessive writes during rapid typing
- Date-guard ensures stale saves from old dates are ignored

### Unsaved Changes Guard
- `hasUnsavedChanges` flag tracks if form is dirty
- Date navigation shows confirm dialog: "Save before navigating?"

### Tab Completion Indicators
- Each nav tab checks if all its fields are filled
- Shows visual indicator (incomplete dot) for tabs with missing data
- Checks run on every input change

### Autocomplete Suggestions
- Weather conditions from past entries
- Diet meals (breakfast/lunch/dinner/snacks) from past entries
- Personal care products from past entries
- App names from past entries
- Travel destinations via suggestion chips

### Import Last Day Data
- **Environment:** "Import Last" copies weather, temp, AQI, humidity, UV from yesterday
- **Personal Care:** "Import Last" copies face/hair products, oil, routine from yesterday

### BMI Calculator
- Auto-calculates when weight & height are both filled
- Shows BMI value + category with color coding

---

## 🔄 Default Values (New Entry)

| Field | Default Value |
|-------|---------------|
| Temperature | 15-25 °C |
| AQI | 0 |
| Humidity | 0% |
| UV Index | 0 |
| Weight | 72 kg |
| Height | 178 cm |
| Chest | 90 cm |
| Belly | 89 cm |
| Sleep Duration | 8:00 |
| Appetite (all meals) | 5 |
| Medications (all periods) | No |
| Physical Symptoms (all periods) | No |
| Meditation Status | No |
| Meditation Duration | 0 |
| Other Notes Status | No |

---

## 📅 Date System

| Feature | Detail |
|---------|--------|
| Format | `YYYY-MM-DD` (e.g. "2026-05-20") |
| Reference Date | July 4, 2003 (for day_id calculation) |
| Day ID | `Math.ceil((currentDate - referenceDate) / 86400000)` |
| Weekday | Auto-calculated from date |
| Navigation | ← Previous Day / Next Day → |
| Date Picker | Native browser date input via `showPicker()` |

---

## 📊 v4.2 JSON Data Schema

```json
{
  "version": "4.2",
  "date": "YYYY-MM-DD",
  "day_id": 8356,
  "weekday": "Wednesday",
  "environment": {
    "temperature_c": "15-25",
    "air_quality_index": 50,
    "humidity_percent": 60,
    "uv_index": 3,
    "weather_condition": "Sunny",
    "environment_experience": "Pleasant day"
  },
  "body_measurements": {
    "weight_kg": 72,
    "height_cm": 178,
    "chest": 90,
    "belly": 89
  },
  "health_and_fitness": {
    "sleep_hours": "8:00",
    "sleep_quality": 8,
    "sleep_quality_description": "Deep sleep",
    "steps_count": 10000,
    "steps_distance_km": 7.5,
    "kilocalorie": 2200,
    "water_intake_liters": 3.5,
    "medications_taken": {
      "morning": "No",
      "afternoon": "Paracetamol",
      "evening": "No",
      "night": "Levocetirizine"
    },
    "physical_symptoms": {
      "morning": "No",
      "afternoon": "Headache",
      "evening": "No",
      "night": "No"
    }
  },
  "mental_and_emotional_health": {
    "mental_state": "Positive",
    "mental_state_reason": "Had a productive day",
    "mood_timeline": {
      "morning": [
        { "mood_level": 8, "mood_category": "positive_high_energy", "mood_feeling": "energetic" }
      ],
      "afternoon": [
        { "mood_level": 7, "mood_category": "positive_high_energy", "mood_feeling": "motivated" }
      ],
      "evening": [
        { "mood_level": 6, "mood_category": "neutral_balanced", "mood_feeling": "calm" }
      ],
      "night": [
        { "mood_level": 5, "mood_category": "low_energy_tired", "mood_feeling": "tired" }
      ]
    },
    "energy_level": 7,
    "energy_reason": "Good sleep and exercise",
    "stress_level": 3,
    "stress_reason": "Minor work deadline",
    "meditation_status": "Yes",
    "meditation_duration_min": 15
  },
  "personal_care": {
    "face_product_name": "Cleanser",
    "face_product_brand": "Cetaphil",
    "hair_product_name": "Shampoo",
    "hair_product_brand": "Dove",
    "hair_oil": "Coconut oil",
    "skincare_routine": "Morning and night"
  },
  "diet_and_nutrition": {
    "breakfast": { "meal": "Dal, roti", "appetite_index": 7 },
    "lunch": { "meal": "Chapati", "appetite_index": 5 },
    "dinner": { "meal": "Rice", "appetite_index": 8 },
    "additional_items": "Protein shake"
  },
  "activities_and_productivity": {
    "tasks_today_english": "Completed project report",
    "travel_destination": "Office",
    "phone_screen_on_hr": "5:30",
    "most_used_apps": [
      { "rank": 1, "name": "YouTube", "time": "2:30" },
      { "rank": 2, "name": "Instagram", "time": "1:45" },
      { "rank": 3, "name": "WhatsApp", "time": "1:00" },
      { "rank": 4, "name": "Chrome", "time": "0:45" },
      { "rank": 5, "name": "Spotify", "time": "0:30" }
    ],
    "app_usage_intent": "Mix of productive and entertainment"
  },
  "decisions": [],
  "additional_notes": {
    "key_events": "Team meeting, gym session",
    "other_note_status": "No"
  },
  "daily_activity_summary": "Productive day with good balance...",
  "overall_day_experience": "Overall a great day..."
}
```

---

## 🏗️ PWA Features

| Feature | Detail |
|---------|--------|
| Manifest | `manifest.json` — name, icons, standalone display, portrait |
| Service Worker | `sw.js` — Caches app shell for offline use |
| Theme Color | `#0f172a` (Dark navy) |
| Install | "Add to Home Screen" on supported browsers |
| Offline | Full functionality after first visit |

---

## 🖥️ Script Loading Order

```html
<script src="js/storage.js"></script>      <!-- 1. IndexedDB engine -->
<script src="js/ui.js"></script>           <!-- 2. UI class (all form logic) -->
<script src="js/mood-handler.js"></script> <!-- 3. Mood timeline add/remove -->
<script src="js/decisions-handler.js"></script> <!-- 4. Decisions JSON manager -->
<script src="js/app.js"></script>          <!-- 5. Bootstrap (async init) -->
```

---
