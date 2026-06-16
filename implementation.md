
# Software Requirements Specification (SRS)
## Project: Vehicle Manager Web Application (Offline-First Architecture)

### 1. Executive Summary
This document outlines the architectural, data, and functional specifications for a localized, zero-dependency **Vehicle Manager Web Application**. Built using native HTML5, CSS3, and Vanilla JavaScript (ES6+), the system tracks vehicle degradation by computing absolute odometer adjustments against individual component maintenance cycles. The application operates strictly offline-first, leveraging `localStorage` for transactional state persistence.

---

### 2. Core Computation Logic & State Engine
The application models a vehicle as a physical system whose degradation correlates linearly with cumulative distance. The global app state relies heavily on a single input value: `O_current` (The current absolute odometer reading).

#### 2.1 Mathematical Formulas for Maintenance Projections
For any given maintenance item `i`, the calculation of the remaining distance operates on three parameters:
* `O_current`: Current total odometer reading.
* `O_last`: Absolute odometer reading during the last logged maintenance event.
* `I`: The predefined operational interval limit (in kilometers).

* **Target Odometer Generation:**
    O_next = O_last + I

* **Remaining Delta Calculation:**
    Delta_remaining = O_next - O_current

#### 2.2 Functional Status Classification Rules
The evaluation engine maps the calculated `Delta_remaining` to three UI operational alerts:
1.  **CRITICAL / OVERDUE:** If `Delta_remaining <= 0` ➔ Status: `🚨 OVERDUE!`
2.  **WARNING / DUE SOON:** If `Delta_remaining > 0` AND `Delta_remaining <= 200` ➔ Status: `⚠️ Due Soon`
3.  **OPTIMAL:** If `Delta_remaining > 200` ➔ Status: `✅ Optimal`

---

### 3. Functional View Requirements

#### 3.1 View A: Unified Dashboard (Home Screen)
* **Odometer HUD (Top Component):** A prominent status header showing the current absolute odometer. Features a number input field and a submit button to mutate the global odometer value. Updating this value fires a cascade re-render across the app.
* **Dynamic Component Trackers:** A container that renders the registered maintenance parts. Items are sorted reactively: components flagged as `🚨 OVERDUE!` float to the top of the interface.
* **Routine Action Anchors:** Two dedicated controls that open floating UI overlays/modals for "Daily Pre-Ride Checklist" and "Monthly Maintenance Protocol".

#### 3.2 View B: Service Configuration Panel (CRUD Operations)
* **Schema Registration Form:** Form layout with data inputs for:
    * Component Identifier/Name (e.g., "Engine Oil", "Drive Chain")
    * Maintenance Interval Jumps (Number input in KM)
    * Initial Baseline Odometer (The KM reading when last serviced)
* **Data Table:** Displays the registered dataset with quick-bind interactive inline actions for `Edit` and `Delete` routines.

#### 3.3 View C: Recurrent Checklists (Time-Based To-Dos)
* **Daily Checklist Module:** High-frequency binary checks focused on rapid pre-ride safety. Configured with a reactive checkbox framework and small descriptor hints.
* **Monthly Checklist Module:** Intermediate-frequency analytical operations that rely on physical inspection rather than mileage changes.

---

### 4. Structural Data Schema (LocalStorage Blueprint)
The system serializes and loads state from a single key-value namespace (`v_manager_db`) mapped to the following JSON payload blueprint:

```json
{
  "meta": {
    "current_odometer": 14500,
    "last_updated_timestamp": 1774844321000
  },
  "services": [
    {
      "id": "srv-9b1b7c2d",
      "name": "Engine Oil (Oli Mesin)",
      "interval_km": 4000,
      "last_service_odometer": 12000
    },
    {
      "id": "srv-4a2e8f11",
      "name": "Spark Plug (Busi)",
      "interval_km": 8000,
      "last_service_odometer": 8000
    }
  ],
  "routine_checks": {
    "daily": [
      { "id": "d-1", "task": "Brake Fluid Level", "desc": "Check visual clarity above the MIN indicator line.", "checked": false },
      { "id": "d-2", "task": "Drive Chain Slack", "desc": "Verify vertical slack stays within 25-35mm.", "checked": true }
    ],
    "monthly": [
      { "id": "m-1", "task": "Battery Electrodes", "desc": "Clean white oxidation scales and measure standing voltage (>12.4V).", "checked": false }
    ]
  }
}

```

---

### 5. Design & Theme Token Specifications

The presentation layer implements a responsive layout utility matching these design parameters:

| Component Context | UI Design Color Token | Typography Rules |
| --- | --- | --- |
| **Global Shell** | Canvas: `#f8fafc` | Dark Text: `#0f172a` | System Sans-Serif, Base: `14px / 1.5rem` |
| **Critical Alerts** | Foreground/Border Accent: `#ef4444` (Red) | Weight: `700` | Letter-Spacing: `-0.025em` |
| **Warning States** | Foreground/Border Accent: `#f59e0b` (Amber) | Weight: `600` |
| **Optimal States** | Foreground/Border Accent: `#10b981` (Green) | Weight: `400` |

---

### 6. Technical Implementation Roadmap for Antigravity AI

To achieve a completely bug-free build environment, execute the codebase construction in these explicit isolated phases:

1. **Phase 1: Database Core (Data Layer):** Establish a single file framework. Initialize structural state defaults, handle browser validation access tokens, and craft global data lifecycle hooks (`getAppState()`, `saveAppState()`).
2. **Phase 2: Mathematical Pure Engines (Logic Layer):** Program isolated JavaScript functions responsible for receiving JSON input, evaluating kilometer remainders, and passing back data status strings. No DOM mutations allowed here.
3. **Phase 3: Render and Event Interactivity (UI Layer):** Build semantic HTML layouts. Wire event listeners (`addEventListener`) into the action forms to read inputs, rewrite data mutations to the storage scope, and trigger clean UI element repaints.
