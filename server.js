/**
 * nBeam Express Server
 *
 * A single persistent Node.js server that:
 * 1. Serves the Vite production build (dist/) as static files
 * 2. Handles HTTP API routes (Tavily, Gemini extract, Gemini chat)
 * 3. Proxies WebSocket connections for Gradium speech-to-text
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local specifically
dotenv.config(); // Fallback to .env
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// Logging middleware for debugging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com https://*.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-src https://maps.googleapis.com",
      "connect-src 'self' https://*.googleapis.com https://api.tavily.com wss://*.gradium.ai ws://localhost:* wss://localhost:*",
    ].join('; ')
  );
  next();
});

// ─── API Routes ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      tavily: !!process.env.TAVILY_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      gradium: !!process.env.GRADIUM_API_KEY
    }
  });
});

// --- Tavily Search Proxy ---
app.post('/api/tavily/search', async (req, res) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error('[tavily] TAVILY_API_KEY is missing');
    return res.status(503).json({ error: 'TAVILY_API_KEY not configured' });
  }

  const upstreamPayload = {
    search_depth: 'basic',
    include_answer: true,
    max_results: 4,
    ...req.body,
    api_key: apiKey,
  };

  try {
    const upstream = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamPayload),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('[tavily] Upstream error:', data);
      return res.status(upstream.status).json(data);
    }
    res.status(200).json(data);
  } catch (e) {
    console.error('[tavily] Proxy crash:', e);
    res.status(502).json({ error: String(e) });
  }
});

// --- Gemini Extraction Proxy ---
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    customerName: { type: 'string' },
    customerAddress: { type: 'string' },
    city: { type: 'string' },
    energyDemandKwh: { type: 'number' },
    energyPricePerKwh: { type: 'number' },
    budgetEur: { type: 'number' },
    numInhabitants: { type: 'integer' },
    hasEv: { type: 'boolean' },
    evAnnualKm: { type: 'number' },
    hasSolar: { type: 'boolean' },
    solarSizeKw: { type: 'number' },
    hasStorage: { type: 'boolean' },
    storageSizeKwh: { type: 'number' },
    hasWallbox: { type: 'boolean' },
  },
};

const EXTRACTION_PROMPT = `You are an extraction assistant for a solar installer's quotation tool. Extract structured data from a free-form description of a residential customer in Germany.

Rules:
- Only include fields explicitly mentioned in the text. Omit anything not mentioned.
- Convert all energy values to kWh, prices to € per kWh, distances to km.
- "customerAddress" must be the full street address as a single string (e.g. "Mustermannstraße 12, 10243 Berlin").
- "city" must be one of: Berlin, Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, Dresden, Leipzig, Bremen.
- "hasSolar"/"hasStorage"/"hasWallbox" should be true only if existing equipment is mentioned.

User description:
"""
{TEXT}
"""`;

app.post('/api/gemini/extract', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const text = (req.body?.text ?? '').slice(0, 4000);
  const upstreamPayload = {
    contents: [{ parts: [{ text: EXTRACTION_PROMPT.replace('{TEXT}', text) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA,
      temperature: 0.1,
    },
  };

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamPayload),
      }
    );
    const data = await upstream.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    res.status(200).json({ fields: JSON.parse(raw) });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// --- Gemini Chat Proxy ---
app.post('/api/gemini/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

  const upstreamPayload = {
    contents: [{ parts: [{ text: req.body?.text }] }],
    tools: [{
      functionDeclarations: [{
        name: 'modify_panel_layout',
        description: 'Modifies the layout of solar panels on a roof.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING' },
            region: { type: 'STRING' },
            count: { type: 'INTEGER' },
          },
          required: ['action', 'region'],
        },
      }],
    }],
    generationConfig: { temperature: 0.1 },
  };

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamPayload),
      }
    );
    const data = await upstream.json();
    const call = data?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    res.status(200).json({ functionCall: call?.args ?? null });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// ─── Static File Serving ────────────────────────────────────────────────────

const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// ─── HTTP + WebSocket Server ────────────────────────────────────────────────

const httpServer = createServer(app);

// Use 'ws' library for robust WebSocket proxying
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (clientWs, request) => {
  const apiKey = process.env.GRADIUM_API_KEY;
  if (!apiKey) {
    console.error('[gradium] GRADIUM_API_KEY missing');
    clientWs.close(1011, 'API key missing');
    return;
  }

  console.log('[gradium] Opening upstream connection...');

  // Connect to Gradium
  const upstreamWs = new WebSocket('wss://eu.api.gradium.ai/api/speech/asr', {
    headers: { 'x-api-key': apiKey }
  });

  upstreamWs.on('open', () => {
    console.log('[gradium] Upstream connected');
  });

  upstreamWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  clientWs.on('message', (data) => {
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data.toString());
    }
  });

  upstreamWs.on('close', () => {
    console.log('[gradium] Upstream closed');
    clientWs.close();
  });

  clientWs.on('close', () => {
    console.log('[gradium] Client closed');
    upstreamWs.close();
  });

  upstreamWs.on('error', (err) => {
    console.error('[gradium] Upstream error:', err);
    clientWs.close(1011, 'Upstream error');
  });

  clientWs.on('error', (err) => {
    console.error('[gradium] Client error:', err);
    upstreamWs.close();
  });
});

httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === '/api/gradium/stt') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // In dev mode, Vite handles its own upgrades (HMR). 
    // This allows non-API upgrades to pass through or be handled elsewhere.
    socket.destroy();
  }
});

httpServer.listen(PORT, () => {
  console.log(`\n  🌞 nBeam server running on http://localhost:${PORT}\n`);
});
