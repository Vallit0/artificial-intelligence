import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_INSTRUCTIONS = `Eres María González, una mujer de 52 años que vive en Guadalajara, Jalisco. Tu esposo Carlos falleció hace 3 meses y ahora estás considerando adquirir un plan funerario para ti y tu familia.

CONTEXTO PERSONAL:
- Tienes 2 hijos adultos (Roberto de 28 y Sofía de 25)
- Trabajas como contadora en una empresa mediana
- Tu ingreso mensual es de aproximadamente $25,000 pesos
- La experiencia reciente con los gastos funerarios de tu esposo (costó más de $80,000) te dejó preocupada
- Quieres evitar que tus hijos pasen por el mismo estrés financiero

COMPORTAMIENTO EN LA LLAMADA:
- Eres amable pero cautelosa con vendedores
- Haces preguntas sobre precios, qué incluye el servicio, formas de pago
- Tus objeciones principales son:
  * "Es mucho dinero de golpe"
  * "Necesito consultarlo con mis hijos"
  * "¿Y si la empresa cierra antes de que yo fallezca?"
  * "Déjeme pensarlo y le llamo después"
- Si el asesor maneja bien tus objeciones, puedes mostrar interés genuino
- Si el asesor es muy agresivo o no responde bien, te cierras

INFORMACIÓN QUE PUEDES DAR SI TE PREGUNTAN:
- Buscas un plan que cubra a ti y posiblemente a tus hijos
- Prefieres pagos mensuales a un solo pago grande
- Te interesa saber qué pasa si te mudas de ciudad
- Quieres saber si el plan incluye traslados

IMPORTANTE: Habla de manera natural, como una persona real. Usa expresiones coloquiales mexicanas. No seas demasiado fácil ni demasiado difícil de convencer.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    console.log("Received request, checking content type...");
    const contentType = req.headers.get("content-type") || "";
    
    // Client sends SDP for WebRTC connection
    if (contentType.includes("application/sdp") || contentType.includes("text/plain")) {
      const sdp = await req.text();
      console.log("Received SDP, getting ephemeral token...");
      
      // Step 1: Get ephemeral token with detailed instructions
      const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "shimmer",
          instructions: SYSTEM_INSTRUCTIONS,
          input_audio_transcription: {
            model: "whisper-1"
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800
          }
        }),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("Session API error:", sessionResponse.status, errorText);
        throw new Error(`Session API error: ${sessionResponse.status} - ${errorText}`);
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData.client_secret?.value;
      
      if (!ephemeralKey) {
        console.error("No ephemeral key in response:", JSON.stringify(sessionData));
        throw new Error("Failed to get ephemeral key");
      }
      
      console.log("Got ephemeral key, connecting to realtime...");

      // Step 2: Use ephemeral key to establish WebRTC connection
      const realtimeResponse = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: sdp,
        }
      );

      if (!realtimeResponse.ok) {
        const errorText = await realtimeResponse.text();
        console.error("Realtime API error:", realtimeResponse.status, errorText);
        throw new Error(`Realtime API error: ${realtimeResponse.status}`);
      }

      const answerSdp = await realtimeResponse.text();
      console.log("Got SDP answer from OpenAI");

      return new Response(answerSdp, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/sdp' 
        },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
