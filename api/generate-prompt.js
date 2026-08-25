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

  const { instruction } = req.body || {};

  if (
    !instruction ||
    typeof instruction !== "string" ||
    instruction.trim().length < 20
  ) {
    return res.status(400).json({
      error: "La información enviada no es suficiente."
    });
  }

  /*
  =====================================
  MODELOS
  =====================================

  Primero intentamos Gemini 3 Flash.
  Si la API key no tiene acceso,
  usamos Gemini 2.5 Flash.
  */

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
                text: instruction
              }
            ]
          }
        ],

        generationConfig: {
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

      console.log("Intentando modelo:", model);

      const resultado =
        await generarConModelo(model);


      /*
      ================================
      SI FUNCIONA
      ================================
      */

      if (resultado.response.ok) {

        const text =
          resultado.data?.candidates?.[0]?.content?.parts
            ?.map(part => part?.text || "")
            .join("")
            .trim();


        if (!text) {

          ultimoError =
            "El modelo respondió pero no generó contenido.";

          continue;
        }


        console.log(
          "PromptLab funcionando con:",
          resultado.model
        );


        return res.status(200).json({

          text,

          model: resultado.model

        });

      }


      /*
      ================================
      SI EL MODELO NO ESTÁ DISPONIBLE
      ================================
      */

      console.error(
        `Error usando ${model}:`,
        resultado.data
      );


      ultimoError =
        resultado.data?.error?.message ||
        "Modelo no disponible";

    }


    /*
    =====================================
    NINGÚN MODELO FUNCIONÓ
    =====================================
    */

    return res.status(502).json({

      error:
        "No se pudo conectar con un modelo Gemini disponible.",

      detail: ultimoError

    });


  } catch (error) {

    console.error(
      "Error PromptLab:",
      error
    );


    return res.status(500).json({

      error:
        "Ocurrió un error al conectar PromptLab con Gemini."

    });

  }

}
