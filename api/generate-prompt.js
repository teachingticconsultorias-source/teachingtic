const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_INPUT_BYTES = 40000;
const REQUEST_TIMEOUT_MS = 45000;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'PromptLab todavía no tiene configurada la conexión con Gemini.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ error: 'La solicitud no contiene JSON válido.' });
    }
  }

  const instruccion = typeof body?.instruccion === 'string'
    ? body.instruccion.trim()
    : '';

  if (!instruccion) {
    return res.status(400).json({ error: 'Falta la información para generar el prompt.' });
  }

  if (Buffer.byteLength(instruccion, 'utf8') > MAX_INPUT_BYTES) {
    return res.status(413).json({ error: 'La información enviada es demasiado extensa.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: instruccion }]
        }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 3000
        }
      }),
      signal: controller.signal
    });

    const data = await geminiResponse.json().catch(() => ({}));

    if (!geminiResponse.ok) {
      console.error('Gemini API error', geminiResponse.status, data?.error?.status || 'UNKNOWN');
      const status = geminiResponse.status === 429 ? 429 : 502;
      const message = geminiResponse.status === 429
        ? 'PromptLab recibió muchas solicitudes. Inténtalo nuevamente en unos momentos.'
        : 'Gemini no pudo generar el prompt en este momento.';
      return res.status(status).json({ error: message });
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Gemini devolvió una respuesta vacía.' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemini tardó demasiado en responder. Inténtalo nuevamente.' });
    }
    console.error('PromptLab server error', error?.message || error);
    return res.status(500).json({ error: 'No se pudo completar la solicitud con IA.' });
  } finally {
    clearTimeout(timeout);
  }
};
