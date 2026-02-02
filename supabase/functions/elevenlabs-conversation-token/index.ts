import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const DEFAULT_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    if (!DEFAULT_AGENT_ID) {
      throw new Error("ELEVENLABS_AGENT_ID is not configured");
    }

    // Parse request body for scenario and optional custom agent
    let scenarioId: string | null = null;
    let customAgentSecretName: string | null = null;
    let scenario: {
      client_persona?: string;
      first_message?: string;
      voice_type?: string;
    } | null = null;

    try {
      const body = await req.json();
      scenarioId = body.scenarioId || body.scenario_id;
      customAgentSecretName = body.agentSecretName || null;
      console.log("Scenario ID received:", scenarioId);
      console.log("Custom agent secret name:", customAgentSecretName);
    } catch {
      // No body or invalid JSON, continue without scenario
    }

    // Determine which agent ID to use
    let agentId = DEFAULT_AGENT_ID;
    
    if (customAgentSecretName) {
      // Try to get the custom agent ID from environment
      const customAgentId = Deno.env.get(customAgentSecretName);
      if (customAgentId) {
        agentId = customAgentId;
        console.log("Using custom agent from secret:", customAgentSecretName);
      } else {
        console.log("Custom agent secret not found, using default agent");
      }
    }

    console.log("Using agent ID:", agentId.substring(0, 20) + "...");

    // If scenario_id provided, fetch scenario details
    if (scenarioId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data, error } = await supabase
        .from("scenarios")
        .select("client_persona, first_message, voice_type")
        .eq("id", scenarioId)
        .single();

      if (!error && data) {
        scenario = data;
        console.log("Scenario loaded:", scenario?.first_message);
      } else {
        console.error("Error fetching scenario:", error);
      }
    }

    // Use the correct endpoint for conversation token (not signed URL)
    const tokenUrl = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
    
    console.log("Fetching signed URL from ElevenLabs...");

    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("ElevenLabs response keys:", Object.keys(data));

    // Return signed_url for WebSocket connection
    return new Response(
      JSON.stringify({
        signedUrl: data.signed_url,
        scenario: scenario
          ? {
              prompt: scenario.client_persona,
              firstMessage: scenario.first_message,
            }
          : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting conversation token:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
