export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'TAVILY_API_KEY not configured' });
  }

  const body = req.body || {};

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
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}
