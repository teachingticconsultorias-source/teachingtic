export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar GEMINI_API_KEY en Vercel."
    });
  }

  const body = req.body || {};

  const instruction =
    body.instruction ||
    body.prompt ||
    body.message ||
    body.input ||
    body.text ||
    "";

  if (
    typeof instruction !== "string" ||
    instruction.trim().length < 5
  ) {
    console.log("Body recibido:", body);

    return res.status(400).json({
      error: "PromptLab no recibió correctamente la información del formulario."
    });
  }

  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  async function generarConModelo(model) {

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({

        contents: [
          {
            role: "user",
            parts: [
              {
                text: instruction.trim()
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4000
        }

      })

    });

    const data = await response.json();

    return {
      response,
      data,
      model
    };
  }


  try {

    let ultimoError = null;

    for (const model of models) {

      console.log("PromptLab intentando modelo:", model);

      const resultado =
        await generarConModelo(model);

      if (resultado.response.ok) {

        const text =
          resultado.data?.candidates?.[0]?.content?.parts
            ?.map(part => part?.text || "")
            .join("")
            .trim();

        if (!text) {
          ultimoError =
            "Gemini respondió pero no generó contenido.";
          continue;
        }

        return res.status(200).json({
          text,
          model: resultado.model
        });
      }

      console.error(
        "Error Gemini:",
        model,
        resultado.data
      );

      ultimoError =
        resultado.data?.error?.message ||
        "Modelo no disponible.";
    }

    return res.status(502).json({
      error: "No se pudo generar el prompt con Gemini.",
      detail: ultimoError
    });

  } catch (error) {

    console.error(
      "Error interno PromptLab:",
      error
    );

    return res.status(500).json({
      error: "Error interno al conectar PromptLab con Gemini."
    });

  }

}
