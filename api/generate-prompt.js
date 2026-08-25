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
          maxOutputTokens: 4096,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
      signal: controller.signal
    });

    const data = await geminiResponse.json().catch(() => ({}));

    if (!geminiResponse.ok) {
      const upstreamStatus = geminiResponse.status;
      const upstreamCode = data?.error?.status || 'UNKNOWN';
      console.error(
        'Gemini API error',
        upstreamStatus,
        upstreamCode,
        data?.error?.message || 'Sin detalle'
      );

      let status = 502;
      let message = 'Gemini no pudo generar el prompt en este momento.';

      if (upstreamStatus === 401 || upstreamStatus === 403) {
        message = 'Gemini rechazó la clave. Genera una nueva clave en Google AI Studio, actualiza GEMINI_API_KEY en Vercel y vuelve a desplegar.';
      } else if (upstreamStatus === 429) {
        status = 429;
        message = 'La cuota de Gemini está agotada o recibió demasiadas solicitudes. Revisa la cuota del proyecto e inténtalo más tarde.';
      } else if (upstreamStatus === 404) {
        message = 'El modelo de Gemini configurado no está disponible para esta clave.';
      } else if (upstreamStatus === 400) {
        message = 'Gemini rechazó la solicitud enviada. Revisa la configuración del modelo.';
      }

      return res.status(status).json({
        error: message,
        code: 'GEMINI_' + upstreamStatus
      });
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
