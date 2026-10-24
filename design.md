# AeroTwin — UI Design Blueprint

A live drone telemetry dashboard and digital twin, for desktop (Tauri + React).

---

## 0. Design rationale — read this before the tokens

Most "AI-generated" dashboards land on one of two looks: a near-black background
with one neon accent doing all the work, or a glassy SaaS look with heavy card
shadows, gradients, and rounded-everything. Both are decoration applied on top
of the content — they'd work equally well for a CRM or a fitness app.

AeroTwin isn't a CRM. It's an **instrument panel**. The actual world this app
lives in — cockpits, ground-control software (QGroundControl, Mission Planner),
radar scopes, avionics placards — already has a visual language: amber caution
lighting, phosphor-green/cyan scope lines, engineering blueprint grids,
monospace tabular readouts, riveted panel bezels. That vocabulary already
solves the brief's actual problem (scan a lot of live numbers fast, under
time pressure) better than a decorative dark theme would. So the rules below
are pulled from that world, not from "attractive dashboard" Pinterest boards.

Two consequences that make this **not** just another dark-mode app:
- **Two accent colors, each with one job** — amber is reserved for caution/
  primary-action, cyan is reserved for "this is live telemetry." They are
  never used interchangeably or decoratively.
- **No shadows, no glass, no gradients.** Depth comes from a 1px border and a
  small change in panel shade — like a physical panel bezel, not a floating
  card. The one recurring signature shape (below) does the "memorable" work
  instead of ambient effects.

---

## 1. Signature element

**Corner-bracket framing + the Attitude Ring.**

Every "live" panel — the digital twin viewport, the primary charts — is
framed by thin L-shaped brackets in the corners, like a camera viewfinder or
a targeting reticle, instead of a bordered card. It signals "this is being
observed in real time," which is literally what the app does.

The **Attitude Ring** is a small circular horizon-line gauge (modeled on a
real aircraft artificial horizon: amber below the line = ground, dark above
= sky, cyan needle = current attitude) used anywhere roll/pitch appears —
on the dashboard, and echoed at smaller scale next to the 3D twin. It's the
one shape a user will remember and associate with the app.

Everything else — cards, buttons, charts — stays quiet and flat so these two
motifs stand out.

---

## 2. Color system

Dark panel is the default surface. Values below are the full token set.

| Token | Hex | Use |
|---|---|---|
| `--bg-hangar` | `#0A0D10` | App background |
| `--bg-panel` | `#12161B` | Card / panel surface |
| `--bg-panel-raised` | `#171C22` | Hover / active panel state |
| `--line-rivet` | `#232A31` | Borders, dividers, grid lines |
| `--text-canopy` | `#E8EDF0` | Primary text |
| `--text-instrument` | `#7C8A96` | Secondary text, placard labels |
| `--accent-signal-amber` | `#F5A623` | Primary actions, caution state, focus ring |
| `--accent-scope-cyan` | `#4FD8E0` | Live telemetry lines, "LIVE" indicators |
| `--status-nominal` | `#3ECF8E` | Nominal / healthy |
| `--status-caution` | `#F5A623` | Caution (same as signal-amber, same meaning) |
| `--status-critical` | `#FF5A5F` | Critical / alert |

**Rules:**
- Amber never appears twice for two different meanings in the same view —
  if it's marking "record" it isn't also marking "primary button" on the same
  screen.
- Cyan is reserved for data that is *currently streaming*. A chart showing
  historical/replayed data uses a neutral gray line instead — cyan means "this
  is happening right now."
- Status colors are never the only signal — see §8 (accessibility).
- No gradients anywhere. No drop shadows except on modal overlays (§7).

### Field Mode (optional light theme)
Drone operators are frequently outdoors in direct sunlight, where a dark UI
is close to unreadable. Ship a genuine second theme, not a decorative toggle:

| Token | Hex |
|---|---|
| `--bg-hangar` | `#F3F2EE` |
| `--bg-panel` | `#FFFFFF` |
| `--line-rivet` | `#D7D5CE` |
| `--text-canopy` | `#14181C` |
| `--accent-signal-amber` | `#B5730A` (darkened for contrast on white) |
| `--accent-scope-cyan` | `#0F8E96` (darkened for contrast on white) |

Same structure, same components — only surface/text/accent values swap.

---

## 3. Typography

Two families from the **same type family**, on purpose: IBM Plex was
designed as a coherent system for technical/engineering contexts, so pairing
Plex Sans with Plex Mono reads like one consistent instrument typeface across
every panel — the way a real cockpit uses one placard font everywhere, not a
mix of display and body fonts fighting each other.

| Role | Typeface | Weight | Usage |
|---|---|---|---|
| Display | **Space Grotesk** | 500 / 600 | Page titles only ("DASHBOARD", "DIGITAL TWIN"). Used sparingly — 2–3 places per screen, never body copy. |
| UI / body | **IBM Plex Sans** | 400 / 500 | Nav labels, buttons, descriptions, alerts |
| Data / numeric | **IBM Plex Mono** | 400 / 500, tabular-nums | All live readouts: altitude, speed, battery, coordinates, timestamps |

**Why monospace for data specifically:** numbers that update every frame
(altitude ticking, battery draining) must not cause layout to jitter as digit
widths change. Tabular monospace figures are a functional requirement here,
not a stylistic choice.

**Placard labels:** small eyebrow labels above each stat are monospace,
uppercase, letter-spaced — `ALT · M`, `SPD · M/S`, `BATT · %` — styled like
physical instrument engraving, not decorative kickers.

```css
--font-display: 'Space Grotesk', system-ui, sans-serif;
--font-ui: 'IBM Plex Sans', system-ui, sans-serif;
--font-data: 'IBM Plex Mono', 'SF Mono', monospace;

--type-page-title: 600 20px/1.2 var(--font-display);
--type-panel-label: 500 11px/1.4 var(--font-data); /* uppercase, 0.08em tracking */
--type-stat-large: 500 32px/1 var(--font-data);     /* tabular-nums */
--type-stat-unit: 400 13px/1 var(--font-ui);
--type-body: 400 14px/1.5 var(--font-ui);
--type-caption: 400 12px/1.4 var(--font-ui);
```

---

## 4. Layout & grid

- 8px base spacing unit. Panel padding: 16px (24px for the twin viewport).
- Persistent **icon rail** on the left (64px collapsed / 200px expanded on
  hover or pin) — not a hamburger menu. This is a monitoring tool left open
  all day; navigation should always be visible.
- **Top status bar** (48px), present on every page: connection state, UDP
  port, mission clock. This never moves or hides.
- Panels sit on a loose 12-column grid, 16px gutters. No panel ever exceeds
  what a single glance can parse — split dense data across panels rather than
  cramming.

### Dashboard (wireframe)
```
┌────┬──────────────────────────────────────────────────────┐
│ ▣  │ AEROTWIN         UDP :14550  ●LINK OK      12:04:33Z  │
│ ▤  ├──────────────────────────────────────────────────────┤
│ ◎  │ ┌ ALT · M ──┐ ┌ SPD · M/S ─┐ ┌ BATT · % ──┐          │
│ ▥  │ │  142.6    │ │   8.4      │ │  76  ▮▮▮▯   │          │
│ ⚑  │ └───────────┘ └────────────┘ └────────────┘          │
│ ⚙  │ ┌ ATTITUDE ──────┐ ┌ ALTITUDE · TIME ─────────────┐  │
│    │ ⌐        ⌐      │ ⌐                             ⌐  │
│    │ │   attitude ring│ │     live chart, cyan line     │  │
│    │ └        ┘      │ └                             ┘  │
│    │ └────────────────┘ └───────────────────────────────┘  │
│    │ ┌ POSITION ──────┐ ┌ SIGNAL · RSSI ────────────────┐  │
│    │ │ 18.5203,73.856 │ │ ▁▂▃▅▇▇▅▃▂▁                    │  │
│    │ └────────────────┘ └───────────────────────────────┘  │
└────┴──────────────────────────────────────────────────────┘
```

### Digital Twin (wireframe)
```
┌────┬──────────────────────────────────────────────────────┐
│ ▣  │ AEROTWIN — DIGITAL TWIN   UDP ●LINK OK    12:04:33Z   │
│ ▤  ├────┬─────────────────────────────────────────┬───────┤
│ ◎  │ATT │⌐                                       ⌐│ORIENT │
│ ▥  │ITUD││                                         ││ATION │
│ ⚑  │E   ││          [ live 3D drone model ]        ││ROLL   │
│ ⚙  │ring││                                         ││PITCH  │
│    │    │└                                       ┘│YAW    │
│    ├────┴─────────────────────────────────────────┴───────┤
│    │ ROLL 2.3°   PITCH −1.1°   YAW 184°   ALT 142.6 m      │
└────┴──────────────────────────────────────────────────────┘
```

The 3D viewport dominates (~65–70% width). Telemetry docks to thin strips at
the edges rather than floating glass cards on top of the model — nothing
should ever visually compete with or obscure the twin itself.

---

## 5. Pages

| Page | Purpose | Key content |
|---|---|---|
| **Dashboard** | Glanceable overall state | Stat cards (alt, speed, battery, GPS), attitude ring, 1–2 live charts, signal strength |
| **Digital Twin** | Spatial/attitude view of the drone | Large 3D model synced to live roll/pitch/yaw, position; edge-docked readouts |
| **Telemetry** | Deep-dive historical charts | Multi-sensor charts, zoom/pan, overlay comparisons, export |
| **Flight Log** | Session history | List of past sessions, duration, max alt/speed, replay a session through the twin |
| **Alerts & Diagnostics** | System health | Chronological log of warnings/link-loss events, current sensor health |
| **Connection & Settings** | Configuration | UDP host/port, packet format, units (metric/imperial), theme (Standard/Field Mode) |

Nav order matches how often each page is checked in practice: Dashboard and
Digital Twin first (always open), Telemetry and Flight Log second (checked
periodically), Alerts always visible via a badge rather than requiring a
visit, Settings last.

---

## 6. Core components

**Instrument card** — flat `--bg-panel`, 1px `--line-rivet` border, 6px
radius (small — a mechanical chamfer, not a soft bubble). Header row: mono
placard label (left) + live-pulse dot (right, cyan/breathing when receiving
UDP packets, gray when idle, red when link lost).

**Live-pulse dot** — 6px circle, 2s ease breathing opacity animation. The
*only* persistent animation in the app — it exists purely to answer "is data
still coming in," nothing else pulses.

**Attitude ring** — SVG gauge, ~120px, amber lower half / dark upper half
split by horizon line, cyan needle for current roll, small pitch ladder.

**Status chip** — dot + label + shape, e.g. `● NOMINAL`, `▲ CAUTION`,
`✕ CRITICAL` (see §8 — shape is not optional).

**Charts** — thin 1.5px lines, no area fill/glow under the line, gridlines at
low-opacity rivet gray, dots appear only on hover. Cyan = live stream, gray =
historical/replay. Recharts or visx both work fine in React; avoid any chart
theme with default gradient fills.

**Buttons** — rectangular, 4px radius, flat. Primary = amber fill / hangar
text. Secondary = outline, rivet border, canopy text. No pill buttons except
status chips.

**Corner-bracket frame** — applied to the twin viewport and to any panel
currently "focused" (e.g. expanded chart). Four independent L-shaped strokes
in the corners, `--line-rivet` at rest, amber when that panel has an active
alert.

---

## 7. Elevation & modals

No shadows anywhere in the base UI — depth is a border + a one-step shade
change (`--bg-panel` → `--bg-panel-raised`) on hover/active. The only
exception: modal/overlay dialogs (e.g., "confirm reconnect") get a single
soft shadow to separate them from the page behind — used nowhere else.

---

## 8. Accessibility & quality floor

- Status is never color-only: nominal/caution/critical each pair a distinct
  shape (✓ / ▲ / ✕) with their color, so the read doesn't depend on color
  vision — meaningful here since misreading a critical alert on real
  hardware has real consequences.
- Text contrast meets WCAG AA against its panel background in both themes.
- All interactive elements have a visible keyboard focus ring (2px, amber).
- Respect `prefers-reduced-motion` — the pulse dot and chart transitions
  drop to instant/static states.
- Responsive down to a reasonable minimum window size (Tauri desktop, but
  users do resize) — panels reflow to single column below ~900px width.

---

## 9. Motion — used sparingly, always functional

Motion here answers a state question, never decorates:

| Moment | Motion |
|---|---|
| UDP packet received | Live-pulse dot breathes (2s ease) |
| New chart data point | Line extends smoothly, no bounce/elastic easing |
| Link lost | Corner brackets on affected panel shift to red, single 400ms transition, then hold — no repeated flashing |
| Page switch | 150ms fade, no slide/parallax |
| New critical alert | One 600ms outline flash on the panel border, then settles to steady red |

No scroll-triggered reveals, no orchestrated load-in sequences — this is a
tool left open for hours, not a page someone scrolls through once.

---

## 10. Data visualization mapping

| Data | Chart type | Color |
|---|---|---|
| Altitude / speed over time | Line chart | Cyan (live) / gray (replay) |
| Battery | Horizontal bar + numeric | Green→amber→red by threshold |
| Roll / pitch | Attitude ring | Amber/cyan per §6 |
| Yaw / heading | Compass arc | Cyan needle on rivet-gray dial |
| Signal / RSSI | Sparkline bars | Cyan, height = signal strength |
| GPS position | Mono coordinate readout + small static map pin | Canopy white text, amber pin |

Keep one chart per metric — avoid combining unrelated metrics on shared axes
just to save space; misread dual-axis charts are worse than two small ones.

---

## 11. Iconography

One icon set only — **Lucide** (already idiomatic in the React ecosystem):
1.5px stroke, no fills, 18–20px in nav, 14–16px inline. Filled variant
reserved for the active/selected nav item only. No emoji anywhere in the UI.

---

## 12. Interface copy

- Name what the operator controls, not the system internals: "Reconnect,"
  not "Reinitialize UDP socket."
- Empty/error states explain what happened and what to do, in the app's
  voice — e.g. when no telemetry is arriving:
  `NO SIGNAL — waiting for telemetry on :14550. Check the drone's broadcast is powered on and the port matches Settings.`
  not a bare "No data."
- Actions and their confirmations share the same verb: a button labeled
  "Start Recording" produces a status that says "Recording," not "Capture
  started."

---

## 13. Do / Don't checklist

**Don't:**
- Purple/indigo gradient buttons or backgrounds
- Glassmorphism / frosted blur cards
- Drop shadows on ordinary panels
- Neon glow under chart lines
- Pill-shaped buttons everywhere
- Numbered 01/02/03 markers where there's no real sequence
- Emoji as icons
- Cream background + serif display + terracotta accent (unrelated to this
  brief's subject)
- A single accent color asked to mean five different things

**Do:**
- Flat panels, 1px borders, one shade step for hover
- Amber = caution/primary action, cyan = "live," always
- Monospace tabular numbers for anything that updates in real time
- Corner-bracket framing + attitude ring as the recurring signature
- Shape *and* color for every status indicator
- Motion that answers "is this live / did something change," nothing else

---

## 14. Implementation notes (Tauri + React)

- Define all tokens in §2–3 as CSS custom properties on `:root`, and a
  `[data-theme="field"]` override block for Field Mode — swap themes by
  toggling the attribute on `<html>`, no component-level branching needed.
- If using Tailwind, map the tokens into `tailwind.config` under `colors` and
  `fontFamily` rather than using arbitrary hex values inline, so the theme
  swap in Field Mode stays centralized.
- Charts: **Recharts** or **visx** — both integrate cleanly with React and
  support fully custom (non-default) line/axis styling, which you'll need to
  strip their default gradient/shadow presets.
- Digital twin 3D: **react-three-fiber** (+ `@react-three/drei`) for the
  viewport; drive the model's rotation directly from incoming roll/pitch/yaw
  each UDP frame rather than animating toward it, unless you want a light
  damping/lerp for visual smoothing between packets (recommended — raw
  telemetry jitter looks noisy on a 3D model, so lerp rotation over ~150ms).
- UDP ingestion happens in the Tauri (Rust) backend; emit parsed telemetry to
  the frontend via `emit`/events rather than polling, so the live-pulse dot
  and charts can react to real packet arrival, not a timer.
- Keep one shared `<Telemetry>` context/store (e.g. Zustand) as the single
  source of truth for current values — the Dashboard, Digital Twin, and
  Telemetry pages all read from it rather than each maintaining their own
  UDP listener.
