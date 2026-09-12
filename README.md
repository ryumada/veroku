---
title: README.md
category: Reference
description: Project overview, features, architecture, and usage guide for Veroku
context: Root Repository
---

# ⚙️ VEROKU — Vehicle Degradation Tracker

**VEROKU** is an offline-first, zero-dependency vehicle degradation tracking and maintenance management progressive web application. Built with vanilla HTML5, CSS3, and modern ES6+ JavaScript, Veroku models vehicle component wear by evaluating absolute odometer distance intervals and service timelines with zero external tracking dependencies.

---

## ✨ Features

- **📊 Dynamic Dashboard**:
  - Live **Odometer HUD** with mileage adjustment and quick log update.
  - Degradation status classification:
    - 🚨 **Critical / Overdue**: Zero or negative mileage/time remaining.
    - ⚠️ **Due Soon / Warning**: Service due within threshold.
    - ✅ **Optimal**: Normal operational condition.
  - Multi-condition dual wear tracking: distance intervals (km/mi) and temporal calendar durations.
  - Circular gauge visualizations indicating wear percentage, delta days, and forecast dates.
  - Inline service notes viewer with Markdown rendering.
  - Direct *"Mark as Done"* action with service cost logging, notes, and timeline recording.

- **🔧 Component Trackers & Service Configuration**:
  - Full CRUD management of tracked vehicle parts and consumable items.
  - Configurable maintenance intervals, baseline service odometer, and time cycles.
  - Search filter and multi-mode sorting (wear priority, name, due distance, due date).

- **📝 Routine Inspection Checklists**:
  - Daily pre-ride safety checklist.
  - Weekly and recurring protocol inspections with persistent checkboxes.

- **📈 Expense & Mileage Analytics**:
  - Monthly spend trend chart.
  - Maintenance history logs with cost tracking and date navigation.

- **🚗 Multi-Vehicle Support**:
  - Switch between multiple vehicles seamlessly.
  - Independent tracking records, checklists, and service history per vehicle.

- **💾 Offline-First & Private**:
  - 100% self-hosted offline fonts and assets.
  - All data resides strictly in local browser storage (`localStorage`).
  - Full JSON backup export and restore capability.
  - Service Worker PWA support with installable manifest.

- **🎨 Design System**:
  - Material Design 3 (M3) Expressive design system.
  - Responsive adaptive layout (desktop sidebar navigation rail, floating mobile header, and bottom navigation bar).
  - Built-in Dark and Light theme toggle.

---

## 🚀 Getting Started

### Prerequisites
Veroku runs on any modern web browser (Chrome, Firefox, Safari, Edge) without requiring build tools or Node.js runtime.

### Running Locally
You can serve the project using any static file server:

```bash
# Using Python
python3 -m http.server 8080

# Or using npx serve
npx serve .
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 📁 Repository Structure

```text
veroku/
├── index.html          # Application markup, modals, and views
├── manifest.json       # PWA Web App Manifest
├── sw.js               # Service Worker for offline asset caching
├── css/
│   └── styles.css      # Material Design 3 design system & responsive styling
├── js/
│   ├── app.js          # App lifecycle, modal handling & event delegation
│   ├── db.js           # LocalStorage database schema, migrations & CRUD
│   ├── engine.js       # Mathematical degradation engine & date computations
│   └── ui.js           # Reactive view renderers, gauges & HUD components
├── fonts/              # Self-hosted offline WOFF2 fonts
└── LICENSE             # MIT License
```

---

## 📄 License

This project is licensed under the [MIT License](file:///home/ryumada/personal_projects/veroku/LICENSE).
