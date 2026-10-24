# AeroTwin 🚁✈️

**AeroTwin** is a high-performance, real-time drone telemetry monitoring dashboard and interactive **3D Digital Twin** platform built for desktop using **Tauri v2, Rust, React, TypeScript, and Three.js (React Three Fiber)**. 

It provides drone operators and engineers with a unified, low-latency window into physical drone state, attitude, power distribution (hybrid battery + hydrogen fuel cell setup), subsystem health, and GPS telemetry over wireless **UDP streams**.

---

## 🌟 Key Features

### 🧊 Interactive 3D Digital Twin
- **Real-Time 3D Motion Visualization**: Live pitch, roll, and yaw rotation synced directly with incoming flight telemetry using smooth lerp interpolation.
- **Custom 3D Drone Model & Sub-components**:
  - Procedurally generated frame, arms, landing gear, and quad propellers with dynamic spinning rotor blur discs mapped to motor power.
  - Custom loaded **3D GLTF models** for the **Hydrogen Fuel Cell Gas Cylinder** and **Lithium Battery Pack**.
  - Real-time 3D **liquid/fill level visualizations** indicating remaining battery percentage and hydrogen tank capacity directly on the model.
- **Interactive Camera Controls**: Orbit, pan, zoom, reset view, and instant preset angles (Isometric, Top, Front, Side).
- **Radar Grid & Visual Themeing**: Responsive 3D floor radar grid and dynamic lighting adapting automatically to Light/Dark mode.
- **Live Viewport Overlay & Component Health**: Floating telemetry HUD overlay showing real-time altitude, speed, attitude, and subsystem status indicators (Motor, FC, Battery, Fuel Cell, GPS, Signal).

---

### 📊 Real-Time Dashboard & Telemetry Visualization
- **Unified Central Command (Dashboard)**:
  - Connection status badge (Connected/Disconnected) with automatic Watchdog timeout detection.
  - Mission duration timer and active alert banners.
  - Integrated flight attitude ring (horizon gauge), altitude sparklines, GPS position summary, and signal strength (RSSI).
  - Power system summary cards and power contribution distribution (Battery vs. Hydrogen Fuel Cell).
- **Deep-Dive Telemetry Page**:
  - **Flight Dynamics**: Multi-sensor rolling history charts for Roll, Pitch, Yaw, Altitude, and Airspeed with selectable time windows (30s, 60s, 5m, All).
  - **Hybrid Power Subsystems**: Detailed tracking of Battery (Voltage, Current, Temp, % SoC), Hydrogen Fuel Cell (Tank Pressure, Tank %, Voltage, Current, Temp), DC Bus (Voltage, Current), and Motor Power.
  - **Navigation & Signal**: Latitude, Longitude, Satellite Count, and RSSI quality indexes.
  - **System Diagnostics**: Real-time alerts evaluation and subsystem safety warnings.

---

### ⚠️ Dynamic Alert & Safety Threshold System
- **Threshold Evaluation Engine**: Monitors incoming telemetry against configured safety rules in real time.
- **Multi-Level Warnings**: Generates `Info`, `Warning`, and `Critical` alerts for parameters like:
  - Low battery / hydrogen fuel tank percentage
  - High battery or fuel cell temperatures
  - Abnormal DC Bus voltages/currents
  - Weak satellite lock or low RSSI signal strength
- **Editable Thresholds**: Fully customizable threshold limits via the Settings menu.

---

### 📜 Flight Log & Mission Management
- **Mission Session Recording**: Automatically logs telemetry snapshots, recording mission start time, duration, peak altitude, max speed, battery consumption, and fuel cell usage.
- **Historical Flight Archive**: Browse past flight logs with filtering by date and status query.
- **Detailed Flight Inspector**: Select any logged mission to review performance metrics and historical telemetry charts.
- **Data Export**: Export flight logs to **CSV** or **JSON** for offline analysis and reporting.

---

### ⚙️ Desktop Native Performance & Hardware Integration
- **Tauri v2 + Rust Backend**: Lightweight desktop app consuming minimal system resources compared to traditional Electron apps.
- **Asynchronous UDP Telemetry Listener**:
  - High-frequency packet ingestion from ESP32 / flight controllers over UDP port `8888` (customizable).
  - Dedicated background thread emitting structured telemetry JSON events (`udp-message`) to the frontend.
- **Dynamic Port Re-binding**: Change listener ports on-the-fly without restarting the application.
- **Watchdog Connection Monitoring**: Automatically detects connection loss when UDP packets cease arriving beyond a configurable timeout (default 3500ms).

---

### 🎨 Glassmorphic Design System & Customization
- **Theme Engine**: Complete support for Dark Mode, Light Mode, and System Theme preferences.
- **Modern Glassmorphism Aesthetic**: Vibrant telemetry cyan accents (`#4FD8E0`), translucent blur panels, curated typography, and smooth micro-animations.
- **Custom Settings**: Configure UDP port, connection timeout, safety thresholds, and theme options.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Runtime** | [Tauri v2](https://tauri.app/) (Rust) |
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite](https://vitejs.dev/) |
| **3D Graphics Engine** | [Three.js](https://threejs.org/) / [React Three Fiber](https://r3f.docs.pmnd.rs/) + [Drei](https://github.com/pmndrs/drei) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Routing** | [React Router v6](https://reactrouter.com/) |
| **Styling** | Vanilla CSS Modules + Glassmorphic Design Tokens |
| **Protocol** | UDP Socket (`std::net::UdpSocket` in Rust) |

---

## 📁 Repository Structure

```
AeroTwin/
├── src-tauri/                 # Tauri v2 Rust Backend
│   ├── src/
│   │   ├── lib.rs            # UDP socket listener & Tauri command handlers
│   │   └── main.rs           # Entry point for desktop binary
│   └── Cargo.toml            # Rust dependencies & metadata
├── src/                      # React Frontend Application
│   ├── assets/               # 3D GLTF models & graphic assets
│   ├── charts/               # Reusable chart components & sparklines
│   ├── components/
│   │   ├── common/           # Live indicators, metrics badges, HUDs
│   │   ├── flight/           # Attitude ring, altitude chart, signal panels
│   │   ├── layout/           # AppShell, Sidebar, Header layout
│   │   ├── power/            # Battery, Fuel Cell, DC Bus & Motor panels
│   │   ├── twin/             # 3D Drone Model, Viewport, Radar Grid, Propellers
│   │   └── ui/               # Reusable UI primitives (Buttons, Cards, Inputs)
│   ├── hooks/                # Custom React hooks (useTauriTelemetry, theme, etc.)
│   ├── lib/                  # Threshold checking & Tauri IPC commands
│   ├── pages/                # Main application views (Dashboard, DigitalTwin, Telemetry, FlightLog, Settings)
│   ├── store/                # Zustand stores (telemetryStore, settingsStore)
│   ├── styles/               # Design tokens, variables & global styles
│   └── types/                # TypeScript interface definitions (Telemetry, Alerts, Logs)
├── public/                   # Static models & public assets
├── package.json              # Frontend dependencies & scripts
└── vite.config.ts            # Vite configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ and `npm`
- **Rust**: Latest stable toolchain (`rustup`)
- **Tauri Prerequisites**: See [Tauri Setup Guide](https://v2.tauri.app/start/prerequisites/) for your operating system (macOS / Windows / Linux).

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/AeroTwin.git
   cd AeroTwin
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

### Development Mode

Run the Tauri desktop application with hot-reloading:

```bash
npm run tauri dev
```

If you only want to run the web frontend in browser:

```bash
npm run dev
```

### Production Build

Build the native desktop executable:

```bash
npm run tauri build
```

The compiled native binary will be generated in `src-tauri/target/release/bundle/`.

---

## 📡 UDP Telemetry Payload Format

AeroTwin listens for JSON telemetry packets over UDP (default port `8888`). Below is an example payload structure expected from the drone's ESP32 or flight controller:

```json
{
  "timestamp": 1700000000000,
  "flight": {
    "altitude": 142.6,
    "speed": 8.4,
    "roll": 2.3,
    "pitch": -1.1,
    "yaw": 184.0
  },
  "gps": {
    "latitude": 18.5203,
    "longitude": 73.8567,
    "satellites": 12
  },
  "battery": {
    "voltage": 13.2,
    "current": 9.3,
    "percentage": 76.0,
    "temperature": 42.0
  },
  "fuelCell": {
    "voltage": 15.1,
    "current": 23.5,
    "temperature": 68.0,
    "tankPercentage": 84.0,
    "pressure": 294.0
  },
  "dcBus": {
    "voltage": 51.6,
    "current": 32.4
  },
  "signal": {
    "rssi": -45.0
  },
  "motor": {
    "power": 350.0
  }
}
```

---

## 📄 License

This project is licensed under the MIT License.