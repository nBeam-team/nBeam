import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';

/**
 * Tavily search proxy. The Vite middleware injects the api_key from
 * process.env (loaded from .env.local) and forwards to api.tavily.com.
 */
function tavilyProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'nbeam-tavily-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tavily/search', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          return res.end();
        }
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'TAVILY_API_KEY not configured' }));
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'invalid json' }));
        }

        const upstreamPayload = {
          search_depth: 'basic',
          include_answer: true,
          max_results: 4,
          ...body,
          api_key: apiKey,
        };

        try {
          const upstream = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(upstreamPayload),
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

/**
 * Gemini extraction proxy. The middleware adds the prompt, structured
 * response schema, and API key, then forwards to gemini-2.5-flash. The
 * client receives `{ fields }` matching ParsedInputs.
 */
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
} as const;

const EXTRACTION_PROMPT = `You are an extraction assistant for a solar installer's quotation tool. Extract structured data from a free-form description of a residential customer in Germany.

Rules:
- Only include fields explicitly mentioned in the text. Omit anything not mentioned.
- Convert all energy values to kWh, prices to € per kWh, distances to km.
- "customerAddress" must be the full street address as a single string (e.g. "Mustermannstraße 12, 10243 Berlin"). Include only when a specific street address is mentioned, not when only a city or neighborhood is given.
- "city" must be one of: Berlin, Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, Dresden, Leipzig, Bremen — only set it if a clearly named German city matches.
- "hasSolar"/"hasStorage"/"hasWallbox" should be true only if existing equipment is mentioned (e.g. "already has", "existing").
- Be conservative: if a number is ambiguous, omit the field rather than guessing.

User description:
"""
{TEXT}
"""`;

function geminiProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'nbeam-gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini/extract', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          return res.end();
        }
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }));
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: { text?: string } = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'invalid json' }));
        }
        const text = (body.text ?? '').slice(0, 4000);
        if (!text.trim()) {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ fields: {} }));
        }

        const upstreamPayload = {
          contents: [{ parts: [{ text: EXTRACTION_PROMPT.replace('{TEXT}', text) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        };

        try {
          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(upstreamPayload),
            },
          );
          const data = (await upstream.json()) as {
            error?: { message?: string };
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: data?.error?.message ?? 'gemini error' }));
          }
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
          let fields: Record<string, unknown> = {};
          try {
            fields = JSON.parse(raw);
          } catch {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'invalid model output' }));
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ fields }));
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

function gradiumSttProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'nbeam-gradium-stt-proxy',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url?.startsWith('/api/gradium/stt')) return;

        console.log('[gradium] WebSocket upgrade request:', req.url, 'headers:', req.headers);

        if (!apiKey) {
          console.log('[gradium] No API key configured');
          socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
          socket.destroy();
          return;
        }

        // Gradium's API uses wss://eu.api.gradium.ai/api/speech/asr (or similar regional endpoint)
        // The path should be /api/speech/asr for the STT WebSocket endpoint
        const upstreamReq = https.request({
          hostname: 'eu.api.gradium.ai',  // Use regional endpoint
          port: 443,
          path: '/api/speech/asr',
          method: 'GET',
          headers: {
            host: 'eu.api.gradium.ai',
            connection: 'Upgrade',
            upgrade: 'websocket',
            'sec-websocket-version': req.headers['sec-websocket-version'] ?? '13',
            'sec-websocket-key': req.headers['sec-websocket-key'] ?? '',
            'x-api-key': apiKey,
          },
        });

        upstreamReq.on('upgrade', (res, upstreamSocket, upstreamHead) => {
          console.log('[gradium] Upstream upgrade response:', res.statusCode, res.headers);

          const response =
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${res.headers['sec-websocket-accept'] ?? ''}\r\n` +
            '\r\n';
          socket.write(response);

          if (upstreamHead?.length) upstreamSocket.unshift(upstreamHead);
          if (head?.length) socket.unshift(head);

          upstreamSocket.pipe(socket);
          socket.pipe(upstreamSocket);

          const destroy = () => {
            console.log('[gradium] Connection destroyed');
            upstreamSocket.destroy();
            socket.destroy();
          };
          socket.on('error', (e) => console.log('[gradium] Client socket error:', e));
          upstreamSocket.on('error', (e) => console.log('[gradium] Upstream socket error:', e));
          socket.on('close', () => {
            console.log('[gradium] Client socket closed');
            upstreamSocket.destroy();
          });
        });

        upstreamReq.on('error', (e) => {
          console.log('[gradium] Upstream request error:', e.message);
          socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          socket.destroy();
        });

        upstreamReq.end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tavilyProxy(env.TAVILY_API_KEY),
      geminiProxy(env.GEMINI_API_KEY),
      gradiumSttProxy(env.GRADIUM_API_KEY),
    ],
  };
});
