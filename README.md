# nBeam: Next-Gen Solar CPQ & Intelligence Platform

**nBeam** is a high-performance, AI-native Solar CPQ (Configure, Price, Quote) platform designed to transform the solar sales workflow. By combining high-resolution satellite data, real-time regional intelligence, and multi-modal AI interaction, nBeam enables installers to generate precise, bankable proposals in seconds.

---

## 🌟 Key Features

### 1. Multi-Modal AI Intake
- **Describe Mode**: Powered by **Google Gemini 2.5 Flash**, users can describe customer requirements in natural language.
- **Speech-to-Text (STT)**: Integrated **Gradium AI** WebSocket streaming for real-time voice-to-description.
- **Structured Extraction**: Automatically parses customer names, addresses, energy demand, and budget into a validated schema.

### 2. High-Precision CAD & Simulation
- **Google Solar API**: High-resolution DSM (Digital Surface Model) and annual flux (sunlight) data for precision panel placement.
- **Interactive Roof Mapping**: Live panel manipulation with real-time yield calculations based on orientation and irradiance.
- **24-Hour Average Simulation**: Dynamic battery Storage-of-Charge (SoC) simulation and load profile matching.

### 3. Regional Intelligence (Tavily AI)
- **Live Market Data**: Real-time fetching of regional electricity prices, local subsidies (EEG updates), and solar news.
- **Context-Aware Recommendations**: Tailors the proposal based on the specific city's energy market.

### 4. Enterprise-Grade Architecture
- **Persistent Express Backend**: Optimized for Railway deployment with a persistent Node.js server.
- **WebSocket Proxying**: Native WebSocket upgrades for low-latency audio streaming.
- **Security-First**: Strict CSP (Content Security Policy) and security headers enforced at the server layer.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript |
| **Styling** | TailwindCSS, Framer Motion (Animations) |
| **Backend** | Node.js, Express (Persistent Server) |
| **AI / LLM** | Google Gemini 2.5 Flash (via Vertex AI / Google AI SDK) |
| **Search/RAG** | Tavily AI (Real-time Market Search) |
| **Voice** | Gradium AI (PCM Streaming WebSocket) |
| **Maps/Solar** | Google Maps Platform, Google Solar API |
| **Deployment** | Railway (Persistent Hosting) |

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 20+
- NPM / PNPM / Yarn

### 1. Clone & Install
```bash
git clone <repository-url>
cd nBeam
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory and provide your API keys:
```env
# Google Cloud
VITE_GOOGLE_MAPS_KEY=your_google_maps_key
VITE_GOOGLE_SOLAR_KEY=your_google_maps_key

# Backend AI Keys
GEMINI_API_KEY=your_gemini_key
TAVILY_API_KEY=your_tavily_key
GRADIUM_API_KEY=your_gradium_key
```

### 3. Development
Run both the frontend (HMR) and the backend (API/Proxy) simultaneously:

**Terminal 1 (Backend):**
```bash
npm run dev:server
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
npm run start
```

---

## 🧪 Technical Documentation (Jury Evaluation)

### API Architecture
The application utilizes a **Persistent Server Architecture** to bypass the limitations of serverless functions regarding WebSockets and long-running proxies. 
- **Endpoint Protection**: All third-party API keys are strictly stored server-side. The `/api` routes act as managed proxies, injecting credentials and enforcing rate limits.
- **STT Pipeline**: Audio is captured via the browser's `AudioContext` as 24kHz Mono PCM data, chunked into 2048-sample buffers, and streamed via `wss://` to the backend. The backend handles the binary handshake with Gradium AI and pipes the transcription tokens back to the React hook.
- **Solar Calculations**: Yield is calculated using a custom engine (`src/lib/calc.ts`) that factors in the building's specific geometry (pitch/azimuth) retrieved from the Google Solar API.

### Performance Optimizations
- **Geotiff Parsing**: Uses `geotiff.js` to process solar irradiance maps locally on the client for zero-latency heatmaps.
- **Debounced Intelligence**: Regional context fetches are debounced to prevent unnecessary API usage while the user inputs the address.

---

## 📜 License
Hackathon Demo - Private
