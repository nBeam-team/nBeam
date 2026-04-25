import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tavilyProxy(env.TAVILY_API_KEY),
      geminiProxy(env.GEMINI_API_KEY),
    ],
  };
});
