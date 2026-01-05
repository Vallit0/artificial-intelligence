import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sessionConfig = {
  type: "realtime",
  model: "gpt-4o-realtime-preview-2024-12-17",
  instructions: `Eres un cliente potencial que está considerando contratar los servicios funerarios de Capillas Señoriales. Tu nombre es María González.

Comportamiento:
- Actúa como alguien que está explorando opciones para un plan funerario
- Haz preguntas sobre precios, servicios, planes de pago
- A veces muestra objeciones comunes: "es muy caro", "necesito pensarlo", "voy a comparar con otros"
- Sé cortés pero firme cuando tengas dudas
- Responde en español naturalmente

Objetivo: Ayudar al asesor a practicar técnicas de venta efectivas y manejo de objeciones.`,
  audio: {
    output: { voice: "alloy" }
  }
};

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
    
    // Unified interface: client sends SDP
    if (contentType.includes("application/sdp") || contentType.includes("text/plain")) {
      const sdp = await req.text();
      console.log("Received SDP, forwarding to OpenAI...");
      
      const fd = new FormData();
      fd.set("sdp", sdp);
      fd.set("session", JSON.stringify(sessionConfig));

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: fd,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const answerSdp = await response.text();
      console.log("Got SDP answer from OpenAI");

      return new Response(answerSdp, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/sdp' 
        },
      });
    }

    // Fallback: ephemeral token approach
    console.log("Using ephemeral token approach...");
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: sessionConfig,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Session created successfully");

    return new Response(JSON.stringify(data), {
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