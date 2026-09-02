export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "La clave de Gemini no está configurada en Vercel."
    });
  }

  let body = req.body || {};

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        error: "No se pudo interpretar la información enviada por PromptLab."
      });
    }
  }

  const userInput =
    body.instruccion ||
    body.instruction ||
    body.prompt ||
    body.message ||
    body.input ||
    body.text ||
    "";

  if (
    typeof userInput !== "string" ||
    userInput.trim().length < 20
  ) {
    return res.status(400).json({
      error:
        "PromptLab no recibió correctamente la información del formulario."
    });
  }

  // =====================================================
  // NUEVA INSTRUCCIÓN MAESTRA PARA GEMINI
  // =====================================================

  const masterInstruction = `
Eres un arquitecto de producto digital, diseñador UX/UI
y especialista en tecnología educativa.

Tu tarea es transformar la información brindada por el docente
en UN PROMPT MAESTRO MUY DETALLADO, listo para copiar y pegar
directamente en v0 de Vercel para construir un prototipo web
educativo funcional.

INFORMACIÓN DEL DOCENTE:

${userInput.trim()}

REGLAS OBLIGATORIAS:

1. No respondas con consejos para el docente.
No expliques cómo crear el prompt.
Entrega directamente el PROMPT FINAL listo para v0.

2. Conserva fielmente:
- problema
- usuario
- contexto
- necesidad
- solución propuesta
- nivel educativo
- contenido proporcionado

3. Si falta algún detalle técnico necesario,
complétalo de forma pedagógicamente razonable,
sin cambiar la intención original del docente.

4. El resultado debe ser MUY ESPECÍFICO,
accionable y suficientemente detallado para que v0
pueda generar una buena primera versión
con una sola generación.

5. Empieza el prompt con una instrucción como:

"Crea una aplicación web educativa, interactiva
y completamente funcional..."

Adapta el tipo de solución según corresponda:
- aplicación educativa
- juego interactivo
- simulador
- chatbot
- dashboard
- recurso interactivo
- herramienta de gestión
- u otra solución solicitada.

6. Organiza obligatoriamente el prompt
con los siguientes apartados cuando correspondan:

- NOMBRE DE LA SOLUCIÓN
- CONTEXTO Y PROPÓSITO
- USUARIO
- OBJETIVO
- EXPERIENCIA GENERAL
- PANTALLAS Y FLUJO
- FUNCIONALIDADES
- CONTENIDO
- INTERACCIONES
- RETROALIMENTACIÓN
- SISTEMA DE PROGRESO O PUNTAJE
- DISEÑO UX/UI
- ACCESIBILIDAD
- RESPONSIVE
- REQUISITOS FUNCIONALES
- RESTRICCIONES

7. Describe PANTALLA POR PANTALLA.

Para cada pantalla indica:
- qué debe ver el usuario
- qué textos aparecen
- qué botones existen
- qué ocurre al presionar cada botón
- cómo continúa a la siguiente pantalla

8. El prototipo debe tener una navegación clara
y sencilla para el usuario.

9. Si se trata de una experiencia educativa,
incluye retroalimentación inmediata y significativa.

Cuando el estudiante se equivoque:
- no revelar inmediatamente la respuesta correcta
- brindar una pista
- permitir un segundo intento
- explicar brevemente cuando corresponda

10. Si el docente pide preguntas,
retos, ejercicios o actividades
pero no proporciona suficientes ejemplos,
crea contenido de muestra coherente
con el nivel educativo y el tema.

El objetivo es que el prototipo salga funcional
desde la primera versión.

11. Si corresponde, incorpora:

- barra de progreso
- contador de actividades
- estados completados
- puntaje
- mensajes de logro
- pantalla de resultados
- opción de volver a intentar
- opción de reiniciar

No agregues estas funciones si no tienen sentido
para la solución planteada.

12. Describe claramente las INTERACCIONES.

Por ejemplo:

- hacer clic
- seleccionar alternativas
- arrastrar elementos
- escribir respuestas
- avanzar entre pantallas
- activar botones
- mostrar mensajes
- actualizar puntajes
- mostrar progreso

13. Especifica un diseño apropiado
para el público objetivo.

Debe incluir:

- jerarquía visual clara
- botones identificables
- textos legibles
- tarjetas
- iconos
- buen contraste
- espacios adecuados
- estados visuales
- interfaz limpia
- navegación sencilla

Evita pantallas saturadas.

14. Si el público son niños o adolescentes,
usa una experiencia visual atractiva,
pero evita un diseño infantilizado
si no corresponde a su edad.

15. Incluye ACCESIBILIDAD básica:

- textos suficientemente grandes
- buen contraste
- no depender únicamente del color
- botones claramente identificables
- instrucciones breves
- navegación comprensible

16. El diseño debe ser RESPONSIVE.

Debe funcionar correctamente en:

- computadora
- tablet
- celular

En pantallas pequeñas,
los elementos deben reorganizarse automáticamente
sin textos cortados ni botones demasiado pequeños.

17. Repite explícitamente que debe construir
UNA APLICACIÓN FUNCIONAL
y NO solamente una maqueta visual.

18. Enumera al final cuáles interacciones
deben funcionar realmente.

Por ejemplo:

- botones
- navegación
- preguntas
- respuestas
- retroalimentación
- puntaje
- progreso
- resultados
- reiniciar

Adapta esta lista al prototipo solicitado.

19. Para este Prototipo 2.0
prioriza datos locales y funcionamiento inmediato.

Por defecto NO agregues:

- inicio de sesión
- registro de usuarios
- pagos
- base de datos
- APIs externas
- panel administrativo
- configuraciones técnicas complejas

Solo inclúyelas si el docente
las solicita de forma indispensable.

20. Prioriza primero:

1. funcionamiento correcto
2. experiencia de usuario
3. diseño visual

21. El prompt debe ser suficientemente detallado
para reducir la cantidad de correcciones posteriores
y aprovechar mejor los créditos de v0.

22. No uses bloques de código.

23. No menciones Gemini ni PromptLab
dentro del resultado.

24. Termina el prompt con:

"Prioriza primero que toda la experiencia funcione
correctamente y después el refinamiento visual."

Devuelve únicamente el PROMPT MAESTRO FINAL
en español, listo para copiar y pegar en v0.
`;

  // =====================================================
  // MODELOS
  // =====================================================

  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  async function callGemini(model) {

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
                text: masterInstruction
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 6500
        }

      })

    });

    let data;

    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        model,
        status: response.status,
        error:
          "Gemini devolvió una respuesta inválida."
      };
    }

    if (!response.ok) {

      return {
        success: false,
        model,
        status: response.status,
        error:
          data?.error?.message ||
          `Error HTTP ${response.status}`
      };

    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

    if (!text) {

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

  try {

    let lastError =
      "No se encontró un modelo disponible.";

    for (const model of models) {

      const result =
        await callGemini(model);

      if (result.success) {

        return res.status(200).json({

          success: true,

          text: result.text,

          model: result.model

        });

      }

      lastError =
        result.error ||
        lastError;

    }

    return res.status(502).json({

      success: false,

      error:
        "No se pudo generar el prompt con Gemini.",

      detail:
        lastError

    });

  } catch (error) {

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
