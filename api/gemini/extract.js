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
- "customerAddress" must be the full street address as a single string (e.g. "Mustermannstraße 12, 10243 Berlin"). Include only when a specific street address is mentioned, not when only a city or neighborhood is given.
- "city" must be one of: Berlin, Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, Dresden, Leipzig, Bremen — only set it if a clearly named German city matches.
- "hasSolar"/"hasStorage"/"hasWallbox" should be true only if existing equipment is mentioned (e.g. "already has", "existing").
- Be conservative: if a number is ambiguous, omit the field rather than guessing.

User description:
"""
{TEXT}
"""`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body || {};
  const text = (body.text ?? '').slice(0, 4000);
  if (!text.trim()) {
    return res.status(200).json({ fields: {} });
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
      }
    );
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message ?? 'gemini error' });
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let fields = {};
    try {
      fields = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'invalid model output' });
    }
    res.status(200).json({ fields });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}
