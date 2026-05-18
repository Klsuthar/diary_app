# 💪 Body Tab - UI Design Guide

## 🤖 AI Agent Instructions

### Design Philosophy
Create a **health-focused, data-driven UI** with these principles:
- **Card-based Layout**: White cards with rounded corners (12px), shadows, 16px padding
- **Visual Hierarchy**: Group related measurements together (body metrics, sleep, activity, health)
- **Color Coding**: Green for good values, yellow for moderate, red for concerning
- **Input Variety**: Number inputs for measurements, time pickers for duration, sliders for quality ratings
- **Emoji Feedback**: Visual feedback on sleep quality slider (😴 → 😊 → 🌟)
- **Default Values**: Pre-fill common values to save time
- **Quick Actions**: Buttons for common operations

### Component Structure Pattern
```
Card Container
├── Section Header (Icon + Title)
├── Input Grid (2 columns for measurements)
│   ├── Input Field (Label + Number Input + Unit)
│   └── Input Field (Label + Number Input + Unit)
└── Helper Text (Optional tips/ranges)
```

### Key UI Sections

**1. Body Measurements Section**
- 2x2 Grid layout for: Weight, Height, Chest, Belly
- Each field: Label above, number input with unit (kg/cm)
- Light gray background containers
- Default values pre-filled
- BMI auto-calculation display (optional)

**2. Sleep Section**
- Time input for sleep duration (HH:MM format)
- Slider for quality (1-10) with emoji feedback
  - 1-3: 😴 Poor (Red)
  - 4-6: 😐 Average (Yellow)
  - 7-8: 😊 Good (Light Green)
  - 9-10: 🌟 Excellent (Dark Green)
- Textarea for sleep quality description
- Character counter below textarea

**3. Activity Section**
- Three number inputs in a row:
  - Steps count (number)
  - Distance (km with decimal)
  - Calories burned (kcal)
- Icon for each metric
- Light background containers

**4. Hydration Section**
- Large number input for water intake (liters)
- Visual water glass icons showing progress
- Quick add buttons: +0.25L, +0.5L, +1L
- Daily goal indicator (e.g., "6/8 glasses")

**5. Health Notes Section**
- Textarea for medications taken
- Textarea for physical symptoms
- Both with placeholder text and character counters
- Suggestion chips for common medications/symptoms

### Color Palette
```
Primary: #667eea (Purple)
Success: #00e400 (Green) - Good health indicators
Warning: #ffff00 (Yellow) - Moderate values
Danger: #ff0000 (Red) - Concerning values
Background: #fff (cards), #f5f5f5 (input containers)
Text: #333 (dark), #666 (muted)
Borders: #e0e0e0
```

### Layout Structure
```
┌─────────────────────────────────────────┐
│  💪 Body Measurements                   │
│  ┌─────────┐  ┌─────────┐              │
│  │ Weight  │  │ Height  │              │
│  │ [65] kg │  │ [170] cm│              │
│  └─────────┘  └─────────┘              │
│  ┌─────────┐  ┌─────────┐              │
│  │ Chest   │  │ Belly   │              │
│  │ [95] cm │  │ [85] cm │              │
│  └─────────┘  └─────────┘              │
├─────────────────────────────────────────┤
│  😴 Sleep                               │
│  Duration: [07:30] HH:MM                │
│  Quality: ━━━━━━●━━━━━━━━━━━━━━━━━━━  │
│  [8] 😊 Good                            │
│  Description:                           │
│  [Slept well, no interruptions...]     │
│  120/200 characters                     │
├─────────────────────────────────────────┤
│  🏃 Activity                            │
│  Steps: [8,500]  Distance: [6.2] km    │
│  Calories: [450] kcal                   │
├─────────────────────────────────────────┤
│  💧 Hydration                           │
│  Water Intake: [2.5] liters             │
│  🥤🥤🥤🥤🥤⚪⚪⚪ (5/8 glasses)          │
│  [+0.25L] [+0.5L] [+1L]                │
├─────────────────────────────────────────┤
│  💊 Medications                         │
│  [Vitamin D, Omega-3...]               │
│  💡 Common: Vitamin D | Omega-3         │
├─────────────────────────────────────────┤
│  🩺 Physical Symptoms                   │
│  [Slight headache in evening...]       │
│  💡 Common: Headache | Fatigue          │
└─────────────────────────────────────────┘
```

---

## UI Components Breakdown

### 1. 💪 Body Measurements Card

**Visual Design:**
- White card with shadow
- Icon 💪 + "Body Measurements" heading
- 2x2 grid layout (responsive: stacks on mobile)
- Each measurement in light gray container

**Input Fields:**
- **Weight**: Number input, default value, unit "kg"
- **Height**: Number input, default value, unit "cm"
- **Chest**: Number input, default value, unit "cm"
- **Belly**: Number input, default value, unit "cm"

**Behavior:**
- Auto-save on blur
- Show BMI calculation if weight & height present
- Highlight if values change significantly from last entry

---

### 2. 😴 Sleep Card

**Visual Design:**
- White card with sleep icon
- Three sections: Duration, Quality Slider, Description

**Duration Input:**
- Time picker (HH:MM format)
- Default: 07:00
- Icon: 🕐

**Quality Slider:**
- Range: 1-10
- Large thumb (24px)
- Color changes based on value:
  - 1-3: Red track
  - 4-6: Yellow track
  - 7-8: Light green track
  - 9-10: Dark green track
- Display: Number + Emoji + Label
  - Example: "8 😊 Good"

**Description Textarea:**
- 3 rows minimum
- Placeholder: "How was your sleep? Any interruptions?"
- Character counter: "X/200 characters"
- Auto-resize as user types

---

### 3. 🏃 Activity Card

**Visual Design:**
- White card with activity icon
- Three inputs in horizontal layout (stacks on mobile)

**Input Fields:**
- **Steps**: 
  - Icon: 👣
  - Number input (no decimals)
  - Placeholder: "0"
  - Format with commas: 8,500
  
- **Distance**: 
  - Icon: 📏
  - Number input (decimals allowed)
  - Unit: "km"
  - Auto-calculate from steps (optional)
  
- **Calories**: 
  - Icon: 🔥
  - Number input (no decimals)
  - Unit: "kcal"

**Behavior:**
- If steps entered, suggest distance (avg: 0.75 km per 1000 steps)
- If distance entered, suggest calories (avg: 50 kcal per km)

---

### 4. 💧 Hydration Card

**Visual Design:**
- White card with water drop icon
- Large number input at top
- Visual glass indicators below
- Quick add buttons at bottom

**Main Input:**
- Large number input (decimals allowed)
- Unit: "liters"
- Font size: 24px
- Centered

**Visual Indicators:**
- 8 glass icons (🥤 filled, ⚪ empty)
- Each glass = 0.25L
- Fill from left to right
- Show progress: "5/8 glasses"

**Quick Add Buttons:**
- Three buttons side by side
- "+0.25L" (one glass)
- "+0.5L" (two glasses)
- "+1L" (four glasses)
- Click to increment main value
- Purple background, white text

**Daily Goal:**
- Show recommended: "Goal: 2L / 8 glasses"
- Green checkmark when goal reached

---

### 5. 💊 Medications Card

**Visual Design:**
- White card with pill icon
- Textarea for input
- Suggestion chips below

**Textarea:**
- 2 rows minimum
- Placeholder: "List medications taken today..."
- Character counter: "X/150 characters"

**Suggestion Chips:**
- Common medications:
  - Vitamin D
  - Omega-3
  - Multivitamin
  - Calcium
  - Iron
- Click to append to textarea
- Gray background, hover: purple

---

### 6. 🩺 Physical Symptoms Card

**Visual Design:**
- White card with stethoscope icon
- Textarea for input
- Suggestion chips below

**Textarea:**
- 3 rows minimum
- Placeholder: "Any physical symptoms or discomfort?"
- Character counter: "X/200 characters"

**Suggestion Chips:**
- Common symptoms:
  - Headache
  - Fatigue
  - Muscle pain
  - Stomach ache
  - Dizziness
  - None
- Click to append to textarea
- Gray background, hover: purple

---

## Spacing & Layout Rules

**Card Spacing:**
- Padding inside cards: 16px
- Gap between cards: 16px
- Bottom padding: 80px (for tab navigation)

**Grid Layout:**
- 2 columns on desktop (gap: 16px)
- 1 column on mobile (stack vertically)
- Equal width columns

**Input Spacing:**
- Label to input: 8px
- Between inputs: 12px
- Input height: 44px minimum (touch-friendly)

**Typography:**
- Section headers: 18px, bold (600)
- Labels: 14px, medium (500)
- Input text: 16px, regular
- Helper text: 12px, muted color

---

## Interactive Behaviors

**Auto-calculations:**
- BMI from weight & height
- Distance from steps (optional)
- Calories from distance (optional)

**Visual Feedback:**
- Input focus: Purple border
- Slider drag: Smooth color transition
- Button click: Slight scale down (0.95)
- Value change: Subtle highlight animation

**Validation:**
- Weight: 20-200 kg (reasonable range)
- Height: 100-250 cm (reasonable range)
- Sleep hours: 0-24 hours
- Water intake: 0-10 liters

**Smart Features:**
- Remember last entered values as defaults
- Suggest values based on history
- Highlight unusual values (too high/low)
- Auto-save on input change

---

## Responsive Design

**Desktop (>768px):**
- 2-column grid for measurements
- Horizontal layout for activity inputs
- Max width: 600px, centered

**Mobile (<768px):**
- Single column layout
- Stack all inputs vertically
- Full width inputs
- Larger touch targets (48px)
- Reduced padding (12px)

**Tablet (768px-1024px):**
- Same as desktop but full width
- Slightly larger fonts

---

## Accessibility

**Touch Targets:**
- Minimum 44px height
- Minimum 44px width for buttons
- Adequate spacing between clickable elements

**Color Contrast:**
- Text: 4.5:1 ratio minimum
- Labels: Clear and readable
- Focus indicators: Visible purple outline

**Keyboard Navigation:**
- Tab through all inputs
- Enter to submit
- Arrow keys for sliders
- Escape to cancel

---

## Key Features Summary

✅ **Body Measurements** - 2x2 grid with default values
✅ **Sleep Tracking** - Duration + Quality slider with emoji feedback
✅ **Activity Metrics** - Steps, distance, calories in one row
✅ **Hydration** - Visual glass indicators + quick add buttons
✅ **Medications** - Textarea with common suggestions
✅ **Symptoms** - Textarea with common symptoms chips
✅ **Auto-calculations** - BMI, distance from steps, calories
✅ **Visual Feedback** - Color-coded sliders, emoji indicators
✅ **Smart Defaults** - Pre-filled values from last entry
✅ **Character Counters** - On all textareas
✅ **Responsive** - Mobile-first, touch-friendly
✅ **Dark Mode** - Automatic theme support

---

## Design Principles Summary

**Simplicity**: Minimal clicks, smart defaults
**Clarity**: Clear labels, units, and feedback
**Efficiency**: Quick add buttons, suggestions, auto-calculations
**Visual**: Emojis, colors, icons for quick understanding
**Consistency**: Same card style, spacing, and interactions as Basic Tab
**Mobile-first**: Touch-friendly, responsive, accessible
