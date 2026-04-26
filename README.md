# nBeam — AI-native Solar CPQ for Installers

> Configure, Price, Quote. In minutes, not hours.

**nBeam** is a Solar CPQ tool that takes a solar installer from "first phone
call" to "signed proposal PDF" in a few minutes. It combines high-resolution
satellite roof analysis (Google Solar API), structured AI extraction
(Gemini), real-time regional market intelligence (Tavily), and voice intake
(Gradium) into a single editor-grade workflow. The result is a formal,
fully-priced proposal with a Bill of Materials, ROI projection vs. baseline,
and a satellite screenshot of the proposed panel layout.

---

## What it does (3-step demo flow)

1. **Customer intake** — pick one of three modes:
   - **Paste / drop** a CRM record (JSON / CSV / Excel TSV) and we map it
     onto the schema.
   - **Describe in words** the customer in a free-form sentence (or dictate
     it via Gradium voice). One click sends to Gemini, which extracts
     `customerName`, `customerAddress`, `energyDemandKwh`, etc. and
     auto-populates the form.
   - **Step by step** — sliders for manual control.
2. **Solar configuration** — Google Solar API returns roof geometry and the
   exact panel positions for the address. The installer adjusts the array
   on a live satellite map (panel slider, lasso add / remove, plain-English
   chat command), watches the financial KPIs update, and toggles the
   irradiance heatmap (rendered client-side from a GeoTIFF).
3. **Proposal** — a print-ready, multi-section PDF with executive summary,
   property + Static-Maps screenshot, line-item BOM, 25-year ROI chart
   (with-solar vs. no-solar comparison), terms, and signature blocks.

---

## Partner technologies — overview

| Partner | Role in nBeam | Where in the app |
|---|---|---|
| **Gradium** | Speech-to-text streaming (24 kHz PCM → live transcript) | Mic button in **describe** mode populates the textarea |
| **Tavily** | Real-time web search synthesis | Six regional-intel cards on every screen (prices, yield, subsidies, install costs, EEG, news) |
| **Google DeepMind / Gemini 2.5 Flash** | Structured data extraction + function-calling | "Extract with Gemini" on describe mode; "Modify the layout" chat command on the map |
| **Google Maps Platform** | Address autocomplete, satellite tiles, PDF screenshot | Step-1 Places autocomplete, step-2 satellite viewer, PDF rooftop screenshot |
| **Google Solar API** | Building geometry, panel candidates, irradiance | Roof outline, draggable panel array, annual-flux heatmap |

### Detailed roles

#### 1. Gradium
Gradium was used to add **speech-to-text (STT) functionality** to the app,
allowing users to dictate customer information instead of typing it. The
implementation includes a WebSocket connection to Gradium's API that streams
microphone audio and returns real-time transcription. This feature was
integrated into the text input mode, with a microphone button that lets
users record voice and automatically populate the customer description
field.

#### 2. Tavily
Tavily is used as a search API proxy in the Vite development server. It
forwards search requests from the client to Tavily's search API
(`api.tavily.com`) with the configured API key, providing web search
capabilities for the application. It looks for Solar news in the area and
lists them as additional information for the PV installer.

#### 3. Google DeepMind / Google Maps Platform
Google DeepMind (specifically the Gemini model) is used for AI-powered data
extraction. The proxy at `/api/gemini/extract` takes free-form text
descriptions of residential customers and uses **Gemini 2.5 Flash** to
extract structured data matching a defined schema (customer details, energy
usage, solar / storage equipment, etc.). Additionally, **Google APIs — Maps
API, Solar API** — are used for fetching map data and solar-related data to
support the solar configuration and proposal generation features.

---

## Technology stack

| Layer | Tech |
|---|---|
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS, Framer Motion (animations), Fraunces + Inter typography |
| **Charts** | Recharts (ROI / 24-h simulation) |
| **Backend** | Node.js + Express (persistent server, port 3001) |
| **WebSocket** | `ws` library (proxies the Gradium STT stream) |
| **Geo / raster** | `@googlemaps/js-api-loader`, `geotiff.js`, `proj4`, `geotiff-geokeys-to-proj4` |
| **AI** | Google Gemini 2.5 Flash (`generativelanguage.googleapis.com`) |
| **Search** | Tavily AI (`api.tavily.com`) |
| **Voice** | Gradium AI (`wss://eu.api.gradium.ai/api/speech/asr`) |
| **Maps** | Google Maps JS, Places, Maps Static, Solar API |

---

## Prerequisites

- **Node.js 20+** and **npm 10+**
- A **Google Cloud Platform project with billing enabled** (free $200/month
  Maps Platform credit covers a hackathon's usage easily).
- A **Tavily API key** — free dev tier works (`tvly-dev-...`).
- A **Google Gemini API key** — free tier works
  ([https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
- A **Gradium API key** — required only for the voice-input feature
  (`gsk_...`). The rest of the app works without it.

### Google APIs to enable on your Maps Platform key

In **Google Cloud Console → APIs & Services → Library**, enable:

1. **Maps JavaScript API** — interactive satellite map on step 2
2. **Places API** (or Places API New) — address autocomplete on step 1
3. **Maps Static API** — rooftop screenshot in the PDF
4. **Geocoding API** — optional but recommended; richer auto-fill of the
   address from Gemini-extracted text. If absent the app falls back to
   Places `findPlaceFromQuery`.
5. **Solar API** — roof geometry, panel candidates, irradiance GeoTIFFs

For production, add **HTTP referrer restrictions** to each key in the
Google Cloud Console.

---

## Setup

```bash
git clone https://github.com/nBeam-team/nBeam.git
cd nBeam
git checkout final_webapp     # or whichever branch is the latest
npm install
cp .env.local.example .env.local
```

Then open `.env.local` and fill in:

```dotenv
# --- Google Maps Platform (client-side) ---
VITE_GOOGLE_MAPS_KEY=         # Maps JS + Places + Maps Static + Geocoding
VITE_GOOGLE_PLACES_KEY=       # optional, currently unused
VITE_GOOGLE_SOLAR_KEY=        # Solar API (falls back to MAPS_KEY)

# --- Server-side AI keys (no VITE_ prefix; never bundled) ---
TAVILY_API_KEY=
GEMINI_API_KEY=
GRADIUM_API_KEY=
```

The three server-side keys (Tavily / Gemini / Gradium) deliberately omit
the `VITE_` prefix so they stay out of the client bundle. They are read at
request time by the Express server (`server.js`) and injected into upstream
API calls.

---

## Run

The app needs **two processes** during development:

```bash
# Terminal 1 — Express backend on :3001
#   serves /api/tavily/search, /api/gemini/extract, /api/gemini/chat,
#   and the /api/gradium/stt WebSocket
npm run dev:server

# Terminal 2 — Vite frontend on :5173
#   proxies /api/* requests through to :3001 (including WebSocket upgrades)
npm run dev
```

Open <http://localhost:5173>.

### Production build

```bash
npm run build
npm run start    # serves the built bundle through the same Express server
```

For a single-process production deployment, `npm run start` runs `server.js`
which both serves the static bundle and handles all `/api/*` routes.

---

## Architecture

### Request flow

```
                    ┌─────────────── browser ───────────────┐
                    │   React UI                            │
                    │   ├── Maps JS, Places (client-side)   │
                    │   └── /api/* fetch + WebSocket        │
                    └────────┬───────────────────────────┬──┘
                             │ HTTP                      │ WSS
                             ▼                           ▼
                    ┌─────────────── Express ───────────────┐
                    │ /api/tavily/search                    │
                    │ /api/gemini/extract                   │
                    │ /api/gemini/chat                      │
                    │ /api/gradium/stt  (WebSocket upgrade) │
                    └────────┬───────────────────────────┬──┘
                             │                           │
                ┌────────────┴────────────┐ ┌────────────┴──────────┐
                │ api.tavily.com          │ │ wss://eu.api.gradium  │
                │ generativelanguage…     │ │ .ai/api/speech/asr    │
                └─────────────────────────┘ └───────────────────────┘
```

### Notable implementation details

- **API key isolation** — Tavily, Gemini, and Gradium keys never reach the
  browser. The Express server in `server.js` injects them at request time.
  Maps / Places / Solar / Static API keys *do* live in the client bundle
  (the Maps JS loader needs them in the page) and should be HTTP-referrer
  restricted in Google Cloud Console.
- **WebSocket race fix** — the client sends its `setup` frame the moment
  its WebSocket opens, but the upstream Gradium socket is still in
  `CONNECTING` state. The Express proxy buffers client frames until
  upstream is `OPEN` and flushes them in order, preserving the binary /
  text frame type.
- **Annual-flux GeoTIFF rendering** — Solar API ships imagery as GeoTIFFs
  in EPSG:3857 (Web Mercator). The browser downloads the file with the
  Solar API key appended, decodes it with `geotiff.js`, reprojects the
  bbox via `proj4` + `geotiff-geokeys-to-proj4` (the same approach the
  official Google Solar demo uses), color-maps each pixel onto an HTML
  canvas, and applies the result as a `google.maps.GroundOverlay`. A
  per-URL cache keeps the toggle instant on subsequent flips.
- **Print-ready PDF** — there is no PDF library. The print stylesheet
  hides the editorial UI and renders a separate, formal `<PrintProposal>`
  layout. The print version of the ROI chart uses **fixed pixel
  dimensions** (no `ResponsiveContainer`) because the print-only
  ancestor is `display:none` until the print dialog opens, leaving any
  responsive component measuring 0×0.
- **Static Maps screenshot** — the PDF embeds a Google Static Maps URL
  with the proposed panel layout drawn as encoded polylines. URL length
  is capped at ~7800 chars (under the 8192 hard limit); ~30 panels fit
  comfortably.
- **Manual Gemini extraction** — the describe-mode AI extraction is
  triggered by a button click rather than firing on every keystroke, to
  keep token usage low. Regex-based extraction runs locally for free as
  an instant fallback.
- **Per-address caching** — Solar API insights, data layers, and Tavily
  intel are cached per-(lat,lng) or per-city in memory, so revisiting the
  same property is free.

---

## Project structure

```
nBeam/
├── server.js                            Express backend + Gradium WS proxy
├── vite.config.ts                       Vite config + /api proxy → :3001
├── tailwind.config.js
├── .env.local.example                   template for the six env vars
├── public/                              static assets
└── src/
    ├── App.tsx                          page state machine (form/loading/solar/results)
    ├── index.css                        globals + print stylesheet
    ├── components/
    │   ├── AddressInput.tsx             Google Places autocomplete
    │   ├── AnimatedNumber.tsx           rAF count-up
    │   ├── EnergyFlow.tsx               SVG flow diagram
    │   ├── Header.tsx, Logo.tsx
    │   ├── ImportModeInput.tsx          paste / drop CRM data
    │   ├── ModeToggle.tsx               three-mode chooser
    │   ├── PrintProposal.tsx            formal PDF layout
    │   ├── RegionalIntel.tsx            6-card Tavily grid
    │   ├── RoiChart.tsx                 25-yr ROI (with-solar vs. baseline)
    │   ├── Slider.tsx, SpecCard.tsx
    │   ├── SolarMap.tsx                 Maps + panel polygons + flux overlay
    │   ├── SolarStrip.tsx, SunMark.tsx  decorative SVGs
    │   └── TextModeInput.tsx            describe mode (Gemini-assisted)
    ├── pages/
    │   ├── InputForm.tsx                step 1: customer + address + intake
    │   ├── Loading.tsx                  transition screen
    │   ├── SolarConfig.tsx              step 2: roof + live design controls
    │   └── Results.tsx                  step 3: results + PDF export
    └── lib/
        ├── calc.ts                      sizing, BOM, savings, ROI + baseline
        ├── dataImport.ts                JSON / CSV / TSV importer
        ├── flux.ts                      annual-flux heatmap renderer
        ├── format.ts                    number / euro formatters
        ├── gemini.ts                    AI extraction + chat-command client
        ├── google.ts                    Maps loader, Solar API, geocoder
        ├── parse.ts                     regex fallback parser
        ├── slp.ts                       synthetic H0 load profile
        ├── staticMap.ts                 Static Maps URL builder
        ├── tavily.ts                    regional context client
        ├── types.ts                     domain types
        ├── useAiParse.ts                manual Gemini extraction hook
        ├── useCountUp.ts
        ├── useGradiumStt.ts             WebSocket + AudioContext STT hook
        └── useRegionalIntel.ts          6-topic Tavily fetcher
```

---

## Calculations

System sizing, BOM, and financials live in `src/lib/calc.ts`. All numbers
are deterministic formulas, not LLM output. Indicative German market rates
(2025) are used as defaults:

| Item | Default |
|---|---|
| PV module (TOPCon, 400 W) | €150 / panel |
| Power optimizer (per panel) | €45 |
| Substructure / mounting | €35 / panel |
| Hybrid inverter | €800 base + €80 / kW |
| Battery storage | €500 / kWh |
| Smart energy meter | €200 |
| Scaffolding | €500 base + €15 / panel |
| DC installation labor | €50 / panel |
| Inverter install | €600 |
| Battery install | €350 |
| Meter cabinet / AC integration | €800 |
| Travel + planning | €450 lump |
| Feed-in tariff | 0.082 €/kWh (overridable per project) |
| Grid carbon factor | 0.38 kg CO₂ / kWh |
| Self-consumption | 30 % without battery, 70 % with battery |
| Electricity price escalation | 3 %/yr (overridable) |

Production estimates use the matching Solar API panel configuration when
available, falling back to a city-based yield otherwise. The ROI chart
shows two trajectories — *with solar* and *without solar (baseline grid
spend)* — so the gap at year 25 expresses the lifetime savings vs.
inaction.

---

## Deployment notes

For a single-process deployment (Railway / Fly.io / a small VM), `npm run
build && npm run start` is sufficient — `server.js` serves both the static
bundle and the `/api/*` routes including the Gradium WebSocket.

For a static frontend hosted on Vercel / Netlify, the four `/api/*`
endpoints need to be replicated as serverless functions (or a thin
edge-server) that:

1. Accept the same JSON request body the client sends.
2. Inject the API key from a server-side environment variable.
3. Forward to the upstream provider.
4. Return the upstream JSON response unchanged.

The frontend uses relative paths to these endpoints, so no client changes
are needed when moving environments.

---

## License

Hackathon demo. All rights reserved.
