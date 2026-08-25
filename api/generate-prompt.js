export default async function handler(req, res) {

  // =====================================================
  // 1. SOLO PERMITIR POST
  // =====================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }


  // =====================================================
  // 2. OBTENER API KEY DESDE VERCEL
  // =====================================================

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {

    console.error(
      "GEMINI_API_KEY no está configurada."
    );

    return res.status(500).json({
      error:
        "La clave de Gemini no está configurada en Vercel."
    });

  }


  // =====================================================
  // 3. LEER EL BODY
  // =====================================================

  let body = req.body || {};


  // Por seguridad, si Vercel lo entrega como string
  // intentamos convertirlo a JSON.

  if (typeof body === "string") {

    try {

      body = JSON.parse(body);

    } catch (error) {

      console.error(
        "No se pudo interpretar el body:",
        error
      );

      return res.status(400).json({
        error:
          "No se pudo interpretar la información enviada por PromptLab."
      });

    }

  }


  // =====================================================
  // 4. OBTENER LA INSTRUCCIÓN
  // =====================================================

  // IMPORTANTE:
  // Tu PromptLab actual está enviando "instruccion".
  //
  // También aceptamos "instruction" para que
  // futuras versiones sigan funcionando.

  const instruction =
    body.instruccion ||
    body.instruction ||
    body.prompt ||
    body.message ||
    body.input ||
    body.text ||
    "";


  console.log(
    "Campos recibidos:",
    Object.keys(body)
  );

  console.log(
    "Longitud de instrucción:",
    instruction.length
  );


  // =====================================================
  // 5. VALIDAR INFORMACIÓN
  // =====================================================

  if (
    typeof instruction !== "string" ||
    instruction.trim().length < 20
  ) {

    console.error(
      "PromptLab envió información insuficiente."
    );

    return res.status(400).json({
      error:
        "PromptLab no recibió correctamente la información del formulario."
    });

  }


  // =====================================================
  // 6. MODELOS GEMINI
  // =====================================================

  // Intentamos Gemini 3 Flash primero.
  //
  // Si la clave/proyecto no tiene acceso,
  // intentamos Gemini 2.5 Flash.

  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];


  // =====================================================
  // 7. FUNCIÓN PARA LLAMAR A GEMINI
  // =====================================================

  async function callGemini(model) {

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;


    console.log(
      `Intentando Gemini con: ${model}`
    );


    const response = await fetch(
      url,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey

        },

        body: JSON.stringify({

          contents: [

            {

              role: "user",

              parts: [

                {

                  text:
                    instruction.trim()

                }

              ]

            }

          ],


          generationConfig: {

            temperature: 0.4,

            maxOutputTokens: 4000

          }

        })

      }
    );


    let data;


    try {

      data =
        await response.json();

    } catch (error) {

      console.error(
        "Gemini devolvió una respuesta inválida."
      );

      return {

        success: false,

        model,

        status:
          response.status,

        error:
          "Gemini devolvió una respuesta que no pudo interpretarse."

      };

    }


    // ===================================================
    // ERROR DEL MODELO
    // ===================================================

    if (!response.ok) {

      const message =
        data?.error?.message ||
        `Error HTTP ${response.status}`;


      console.error(
        `Error con ${model}:`,
        message
      );


      return {

        success: false,

        model,

        status:
          response.status,

        error:
          message

      };

    }


    // ===================================================
    // EXTRAER TEXTO
    // ===================================================

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          part =>
            part?.text || ""
        )
        .join("")
        .trim();


    if (!text) {

      console.error(
        `${model} respondió sin texto.`
      );


      return {

        success: false,

        model,

        error:
          "Gemini respondió pero no generó contenido."

      };

    }


    return {

      success: true,

      model,

      text

    };

  }


  // =====================================================
  // 8. INTENTAR LOS MODELOS
  // =====================================================

  try {

    let lastError =
      "No se encontró un modelo disponible.";


    for (const model of models) {

      const result =
        await callGemini(model);


      // ===============================================
      // FUNCIONÓ
      // ===============================================

      if (result.success) {

        console.log(
          `PromptLab generado correctamente con ${model}`
        );


        return res.status(200).json({

          success: true,

          text:
            result.text,

          model:
            result.model

        });

      }


      // ===============================================
      // FALLÓ → PROBAR SIGUIENTE MODELO
      // ===============================================

      lastError =
        result.error ||
        lastError;


      console.log(
        `${model} no funcionó. Probando siguiente modelo...`
      );

    }


    // =================================================
    // NINGÚN MODELO FUNCIONÓ
    // =================================================

    console.error(
      "Ningún modelo Gemini funcionó:",
      lastError
    );


    return res.status(502).json({

      success: false,

      error:
        "No se pudo generar el prompt con Gemini.",

      detail:
        lastError

    });


  } catch (error) {


    // =================================================
    // ERROR INESPERADO
    // =================================================

    console.error(
      "Error interno PromptLab:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        "Ocurrió un error interno al conectar PromptLab con Gemini.",

      detail:
        error?.message ||
        "Error desconocido."

    });

  }

}
