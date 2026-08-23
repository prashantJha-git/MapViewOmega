# AccessRide v2.0 Pro: Multi-Modal Transit & Safety Platform

**Accessibility-First Transit routing, real-time geofence safety monitoring, on-device OCR barrier scanning (with an honestly-labeled demo fallback), and serverless P2P multi-device synchronization via copy/paste or native Share.**

AccessRide is a production-grade single-page web app that empowers riders with diverse mobility, sensory, and safety needs to navigate transit networks safely and barrier-free — while providing transit operators with real-time fleet telemetry, geofenced hazard alerts, and ML-powered crowding/safety forecasting.

---

## 1. Integrated Features & Architecture

```
                                  +-------------------------------------------------------------+
                                  |                     AccessRide App                          |
                                  +-------------------------------------------------------------+
                                        |                |                  |                |
           +----------------------------+                |                  |                +----------------------------+
           |                                             |                  |                                             |
           v                                             v                  v                                             v
+-----------------------+                    +--------------------+ +--------------------+                    +-----------------------+
|  Dynamic Any-Point    |                    |  GridPulse Safety  | |   Scan & Report    |                    |  Serverless P2P Sync  |
|  Routing Engine       |                    |  & Geofence Layer  | |   OCR Classifier   |                    |  & Emergency SOS      |
+-----------------------+                    +--------------------+ +--------------------+                    +-----------------------+
| • Tap any 2 map pins  |                    | • Dynamic pulse    | | • Client-side OCR  |                    | • WebRTC DataChannel  |
| • OSM Nominatim Search|                    |   hazard zones     | | • Barrier signage  |                    |   (Google STUN)       |
| • OSRM walking paths  |                    | • Multi-tile map   |   classifier         |                    | • SVG QR Code         |
| • Snapped transit legs|                    | • Proximity alert  | | • Real camera OCR* |                    | • WebRTC DataChannel  |
| • First/last mile     |                    |   audio chime      | • Demo Mode fallback |                    |   (Google STUN)       |
|   walk calculation    |                    | • Incident triage  |   *=browser-dependent |                    | • Copy/Share handshake |
+-----------------------+                    +--------------------+ +--------------------+                    +-----------------------+
```

| Feature Area | Technology | Capabilities |
|---|---|---|
| **Any-Point Dynamic Routing** | Nominatim Geocoding + OSRM Pedestrian Routing + Haversine Engine | Pick literally any two points on the globe, search addresses, use GPS, and calculate complete multi-modal itineraries with verified first-mile & last-mile walking paths. |
| **GridPulse™ Safety & Geofencing** | Leaflet + Multi-Tile Providers (CARTO, OSM, Dark, Satellite) + Collision Math + Proximity Clustering | A fixed baseline layer of reference zones, plus zones dynamically clustered in real time from live, unresolved community reports (labeled "Live Cluster" vs "Baseline Zone" in the map popup) — proximity hazard alerts with audio chimes, incident claiming and dispatching. |
| **Scan & Report (OCR)** | Real camera capture (`getUserMedia`) + native `TextDetector` API where the browser supports it (e.g. Chrome/Android), regex/semantic signage classifier (zero API key needed) | Opens the real device camera or reads an uploaded photo; runs genuine on-device text detection when the browser has it, and otherwise falls back to a clearly-labeled "Demo Mode" sample instead of quietly faking OCR output. The classifier itself (category/severity/keyword detection) always runs for real on whatever text it's given. |
| **Serverless P2P Sync** | WebRTC `RTCDataChannel` (Google STUN) + Outbox / SyncCursor LWW Store + Copy/Share pairing codes | 100% serverless browser-to-browser data sync for saved routes, ICE emergency contacts, accessibility preferences, and real-time P2P Emergency SOS broadcast. Pairing is done by copying or natively sharing (`navigator.share`) the handshake code between devices — reliable today. QR-code pairing was removed after it turned out to render an unscannable decorative pattern; see §6 for why, and how to add a real one. |
| **Accessibility Profiles** | WCAG 2.1 AAA Theming + Speech Synthesis | 6 tuned mobility profiles (Wheelchair, Elderly, Night Safety, Vision/Hearing, Quiet/Sensory, Standard) with high-contrast mode and font scaling. |
| **Predictive Insights (ML)** | Pure TypeScript In-Browser ML | Softmax cyclical-hour crowd classifier and L2-regularized safety score estimator. |
| **Operator Command Desk** | Real-time Telemetry & Incident Queue | Live vehicle fleet tracking, ramp health monitoring, and system-wide broadcast alerts. |

---

## 2. Tech Stack

- **Build System**: Vite 5.4 + TypeScript 5/6
- **UI Framework**: React 19 (Component-driven architecture)
- **Styling**: Tailwind CSS 3 + WCAG 2.1 AAA High Contrast Engine (`src/custom.css`)
- **Mapping & Geodata**: Leaflet, OpenStreetMap Nominatim, OSRM Public Routing Profile, CARTO Tiles
- **P2P Networking**: WebRTC `RTCPeerConnection` with DataChannel (`accessride-p2p-sync`) & Google STUN
- **Machine Learning**: Dependency-free numeric matrix algorithms (Softmax, Sigmoid, L2-Ridge Regression)

---

## 3. Getting Started

### Prerequisites
Node.js 18+ and npm installed.

### Installation & Run

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Typecheck and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 4. Feature Guides

### 🗺️ Any-Point Door-to-Door Routing
1. Open the **Route Planner** tab.
2. Click **"🗺️ Pick on Map"** next to Starting Point or Destination, then tap anywhere on the map to drop a custom pin.
3. Alternatively, search any global address or campus landmark using the integrated top search bar.
4. Click **🎯 (Locate Me)** to use real GPS coordinates.
5. The engine calculates door-to-door transit options with turn-by-turn walking legs (OSRM) before and after transit lines, with complete step-free and safety breakdowns.

### 🛡️ GridPulse™ Safety Map & Geofencing
1. Switch to the **GridPulse™** tab.
2. View active hazard heat zones and incident pins with category emojis (🚑 Medical, 🔥 Fire, ⚠️ Hazard, 🚧 Barrier, 🔧 Infrastructure, 💡 Lighting).
3. Zones come in two flavors, both shown on the map and labeled in each popup: a fixed **Baseline Zone** layer, and **Live Cluster** zones computed on the fly by grouping nearby unresolved community reports (2+ reports close together, or any single critical one).
4. Toggle base map tiles: **CARTO Clean**, **OpenStreetMap**, **Tactical Dark**, or **Satellite View**.
5. Test geofence collision alerts using the **"Test Geofence Position"** buttons at the bottom left to simulate walking into hazard zones.

### 📷 Scan & Report (OCR)
1. Switch to the **Scan & Report** tab or click **"Scan Sign with OCR"** inside the Report Modal.
2. A banner at the top tells you, honestly, what your browser can do: 🟢 if it has a native on-device text-detection engine (real OCR will run), or 🟡 if it doesn't (results will be a clearly-labeled demo sample instead of fabricated text).
3. Click **"Open Camera"** to actually access your device camera and capture a real photo, or **"Upload Sign Photo"** to analyze an existing image — or pick a sample sign to see the classifier work without needing a photo at all.
4. Every result carries a provenance badge (🟢 Live OCR vs 🟡 Demo Mode) so you always know whether the extracted text came from the image or from a labeled fallback. The severity/category classifier itself is real either way and always runs on whatever text is shown.
5. Click **"Auto-Fill & Post Community Report"** to push the result into a new report.

### 🔄 Serverless P2P Multi-Device Sync
1. Open the **P2P Sync** tab on Device A (e.g., Laptop) and click **"Generate Pairing Code"**.
2. **Copy** the code or tap **Share** (uses your OS share sheet via `navigator.share` where supported) and send it to Device B by whatever channel you like — text, AirDrop, email, etc.
3. On Device B, open the **P2P Sync** tab, select **"Join with Code"**, and paste the pairing code to generate an Answer code.
4. Copy or Share that Answer code back to Device A to establish a direct WebRTC DataChannel.
5. Saved routes, ICE emergency contacts, and accessibility preferences sync automatically with Last-Write-Wins (LWW) conflict resolution.
6. Click **"Broadcast SOS"** to fire an instant emergency alert that triggers an audible alarm and notification on all paired devices!

> There's no QR-code scanning step — see **§7 Known Limitations** for why, and how to add real QR support later.

---

## 5. Directory Structure

```
src/
├── App.tsx                     Root application component & navigation orchestrator
├── main.tsx                    Vite application entry point
├── index.css                   Tailwind + Leaflet base styles
├── custom.css                  Accessible theming & high-contrast styles
│
├── types/
│   └── transit.ts              Unified TypeScript interfaces (TripPoint, GridPulse, Sync, OCR)
│
├── utils/
│   └── geo.ts                  Haversine distance, point-in-polygon, bearing, nearest stop
│
├── services/
│   ├── geocoding.ts            Nominatim search, reverse geocoding & OSRM walking path router
│   ├── dynamicRouting.ts       Door-to-door multi-modal routing wrapper with walking first/last miles
│   ├── routingEngine.ts        Core multi-criteria transit route scorer & ranker
│   ├── transitService.ts       In-memory reactive data store for transit stops, lines, and reports
│   └── speechService.ts        Web Speech API wrapper for accessibility announcements
│
├── features/
│   ├── gridpulse/              GridPulse™ Dynamic Geofencing & Safety Map Layer
│   │   ├── types.ts            GeofenceZone, MapIncidentPin, AlertRecord definitions
│   │   ├── gridPulseEngine.ts  Dynamic zone clustering, tile configs & proximity audio chimes
│   │   ├── AlertBanner.tsx     Real-time accessible geofence alert notification strip
│   │   └── GridPulsePanel.tsx  Interactive full-screen safety command map & incident manager
│   │
│   ├── ocr/                    On-device OCR Barrier Scanner & Sign Classifier
│   │   ├── scanReport.ts       Regex & semantic signage classifier with barrier dictionary
│   │   ├── ocrEngine.ts        Real getUserMedia camera capture + native TextDetector OCR, honest demo fallback
│   │   └── ScanReportPanel.tsx Camera modal/upload panel, OCR provenance badges & auto-reporting panel
│   │
│   └── sync/                   Serverless WebRTC Peer-to-Peer Multi-Device Sync
│       ├── syncModels.ts       SyncCursor, SyncOutboxEntry, SyncedState, and SyncPayload models
│       ├── p2pService.ts       WebRTC DataChannel manager (Google STUN) & SOS broadcaster
│       ├── qrHelper.tsx        Capability check + notes on why QR pairing was removed (see §7)
│       ├── syncStore.ts        Last-Write-Wins (LWW) conflict resolver & outbox queue
│       └── SyncPanel.tsx       Pairing UI (Copy/Share codes), synced routes, ICE contacts & emergency beacon
│
├── components/                 UI Screens & Modals
│   ├── HomeScreen.tsx          Overview dashboard with quick presets & safety summary
│   ├── RoutePlanner.tsx        Door-to-door trip planner with map-picking & route cards
│   ├── MapView.tsx             Interactive Leaflet map with address search, GPS, and custom pins
│   ├── JourneyMode.tsx         Turn-by-turn guidance with 4-stage emergency escalation
│   ├── OperatorDashboard.tsx   Fleet telematics, incident queue, and advisory dispatcher
│   ├── InsightsPanel.tsx       Predictive crowd & safety ML models
│   ├── Navbar.tsx              Header navigation with contrast toggle and 7 main tabs
│   ├── RouteCard.tsx           Accessibility-scored route card component
│   ├── RouteDetailModal.tsx    Full step-by-step itinerary breakdown modal
│   ├── PreferenceModal.tsx     Accessibility profile and filter customization modal
│   └── ReportModal.tsx         Community reporting modal with integrated OCR scanner
│
└── ml/                         In-Browser Machine Learning Models
    ├── mathUtils.ts            Dot product, softmax, sigmoid, normalization
    ├── crowdModel.ts           Cyclical hour rush-hour crowding classifier
    ├── safetyModel.ts          L2-regularized corridor safety estimator
    └── index.ts                ML barrel export
```

---

## 6. This Build: Merge & Polish Notes

This package is the single, consolidated result of merging four previously separate source trees into one deployable app:

- **`mapViewOmega`** (original 5-screen base app: profiles, routing, journey mode, reporting, operator dashboard, ML insights)
- **`multi-device-sync`** (a real ASP.NET Core sync service, but from an unrelated medical clinic app — no nearby-device/Bluetooth logic existed there, so it was **not** reused; the P2P feature below was built from scratch instead)
- **`GridPulseMap`** (a Leaflet safety map component, missing its type/helper dependencies and hardcoded to one campus — rebuilt as a dynamic, data-driven `features/gridpulse/` module)
- **`shopkeeper-ocr`** (an invoice/receipt OCR parser — its reusable text-classification core was repointed at accessibility barrier signage as `features/ocr/`)

On top of that integration, this pass added:

- Tap-anywhere routing with real address search (Nominatim) and real walking paths (OSRM) — not just the 8 preset stops
- Serverless WebRTC peer-to-peer device sync with a Copy/Share code handshake (genuine nearby-device pairing, zero backend)
- A visual polish pass: a themed background treatment, consistent `focus-visible` keyboard-navigation rings (important for an accessibility-first app), skeleton loading states instead of bare "Loading…" text, refined shadows/transitions, and centralized design tokens in `tailwind.config.js`

A later audit pass then found and fixed three places where the app looked more capable than it actually was — see **§7 Known Limitations & What Was Fixed** below for the honest before/after on each.

### Before you run it
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```
If `npm run build` ever fails with an error mentioning `Cannot find native binding` (an npm optional-dependency bug, see npm/cli#4828), just delete `node_modules` and `package-lock.json` and run `npm install` again — it re-fetches the correct binary for your OS/CPU automatically.

---

## 7. Known Limitations & What Was Fixed

An earlier audit of this codebase found three features that looked more capable in the UI/README than what the code actually did. Here's the honest state of each after this pass, and what's still genuinely open.

### 📷 OCR — real where the browser supports it, honestly labeled where it doesn't
**Before:** "Camera Snap" injected one hardcoded string regardless of what the camera saw. "Upload Sign Photo" never looked at pixels — it derived fake "OCR text" from the uploaded filename. `tesseract.js` wasn't even a dependency.

**Now:**
- **Open Camera** genuinely calls `getUserMedia`, shows a live preview, and captures a real frame.
- **Upload Sign Photo** genuinely loads and decodes the image.
- Both then attempt **real OCR** via the browser's native Shape-Detection `TextDetector` API. Where that's available (Chrome/Chromium on Android today; occasionally desktop behind a flag), you get actual pixel-derived text, badged 🟢 **Live OCR**.
- Where it isn't available (most desktop Chrome/Firefox/Safari as of writing), the app says so up front via a banner, and any result is badged 🟡 **Demo Mode** with a representative sample — never fabricated from your filename or silently passed off as real.
- The regex/severity classifier (`scanReport.ts`) was already solid and is unchanged — it now just always gets an honest label on where its input text came from.
- **Still open:** for guaranteed OCR on every browser (not just Chrome/Android), install `tesseract.js` (`npm install tesseract.js`) and uncomment the ready-made hook in `features/ocr/ocrEngine.ts`. Not wired in by default because this pass had no network access to install it or verify the integration end-to-end.

### 🔄 P2P Sync — QR code removed, Copy/Share is the real path
**Before:** the "QR code" was an SVG rendered from a hash of the pairing token — finder-square-shaped, but not a real QR encoding. No phone camera could ever decode it, there was no QR *scanner* anywhere in the app either, and the token was silently truncated to 120 characters before being "encoded," which would have corrupted a real handshake regardless.

**Now:** the fake QR is gone. Copy-to-clipboard and native **Share** (`navigator.share`, opens your OS share sheet on supported devices/browsers) are the primary, fully-working pairing path — this was already real and correctly wired to genuine WebRTC (`RTCPeerConnection`, offer/answer, data channel); only the QR *decoration* was fake.

**Why there's no real QR yet, and why that's a deliberate choice, not an oversight:** a WebRTC offer/answer token embeds the full SDP plus ICE candidates (since this app has no signaling server to trickle candidates through separately), which commonly runs 1–3+ KB. That's a poor fit for QR — either it doesn't fit in a code dense enough to still be reliably camera-scannable, or it only works for unusually short sessions. This is a known, real constraint of serverless WebRTC pairing, not something a better QR *encoder* alone fixes. Rather than hand-roll a Reed-Solomon QR implementation I have no way to verify against a real scanner (no network or camera in this build environment), the honest move was to ship the reliable Copy/Share path and leave QR as a documented follow-up:
- **To add real QR support:** `npm install qrcode`, then render its output wherever `canFitInQr(token)` in `features/sync/qrHelper.tsx` returns `true` (it's a conservative size gate, already wired to nothing on purpose). This is a well-tested library — safer than a from-scratch encoder nobody has scanned with a real phone.
- **To make tokens routinely fit:** the cleanest fix is architectural — add a lightweight signaling relay so devices exchange a short room code instead of the full SDP. That's a bigger change and intentionally out of scope here, since it trades away the "100% serverless" property this feature currently has.

### 🛡️ GridPulse — zones are now actually dynamic
**Before:** incident pins came from live `CommunityReports` (this part was always real), but the geofence *zones* were a fixed set of default polygons — despite being described elsewhere as clustered from real reports.

**Now:** `gridPulseEngine.ts` clusters live, unresolved reports by proximity (`deriveLiveClusterZones`) into real hazard/caution zones sized and colored from the cluster's reports, shown alongside the original fixed reference zones. Every zone popup is labeled **● Live Cluster** or **○ Baseline Zone** so it's clear which is which. This also fixed a real bug: the zone-rendering effect previously had an empty dependency array, so zones never re-rendered when new reports came in even before today's fix — they were rendered once, at map init, and never touched again.

### Everything else
Routing (address search, OSRM walking paths, tap-anywhere-on-map), the ML models, and the core screens were already real and correctly wired, and weren't touched beyond what's noted above.

### A note on verification
This pass was made without network access — `npm install` was unavailable, so no new dependencies were added, and no `npm run build` / `npm run dev` could be run to confirm a green build. Please run `npm install && npm run build` after pulling these changes and file an issue (or just ping) if anything doesn't compile — the changes here are scoped, self-contained, and don't touch `package.json`, so a clean install should behave the same as before.
