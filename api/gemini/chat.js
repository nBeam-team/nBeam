export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body || {};

  const upstreamPayload = {
    contents: [{ parts: [{ text: body.text }] }],
    tools: [{
      functionDeclarations: [{
        name: 'modify_panel_layout',
        description: 'Modifies the layout of solar panels on a roof.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', description: 'remove or add' },
            region: { type: 'STRING', description: 'north, south, east, or west' },
            count: { type: 'INTEGER', description: 'number of panels' }
          },
          required: ['action', 'region']
        }
      }]
    }],
    generationConfig: {
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
    const call = data?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    res.status(200).json({ functionCall: call && call.name === 'modify_panel_layout' ? call.args : null });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}
