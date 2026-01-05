import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Client sends SDP for WebRTC connection
    if (contentType.includes("application/sdp") || contentType.includes("text/plain")) {
      const sdp = await req.text();
      console.log("Received SDP, getting ephemeral token first...");
      
      // Step 1: Get ephemeral token using the published prompt
      const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          prompt: {
            id: "pmpt_695b183871008196aa1cb912d084d760012b40cd18369673",
            version: "2"
          }
        }),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("Session API error:", sessionResponse.status, errorText);
        throw new Error(`Session API error: ${sessionResponse.status}`);
      }

      const sessionData = await sessionResponse.json();
      const ephemeralKey = sessionData.client_secret?.value;
      
      if (!ephemeralKey) {
        console.error("No ephemeral key in response:", sessionData);
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

    // Fallback: just return ephemeral token
    console.log("Returning ephemeral token...");
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        prompt: {
          id: "pmpt_695b183871008196aa1cb912d084d760012b40cd18369673",
          version: "2"
        }
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
