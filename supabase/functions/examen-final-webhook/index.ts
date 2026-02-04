import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session_id from query param (dynamic variable from ElevenLabs)
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    // Get evaluation data from POST body
    const body = await req.json();
    const { score, passed, feedback } = body;

    console.log("Examen Final webhook - session:", sessionId, "score:", score, "passed:", passed);

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "session_id query param required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the practice session
    const { data: session, error: sessionError } = await supabase
      .from("practice_sessions")
      .update({
        score: score ?? 0,
        passed: passed ?? false,
        ai_feedback: feedback ?? "",
      })
      .eq("id", sessionId)
      .select("user_id, scenario_id")
      .single();

    if (sessionError) {
      console.error("Error updating session:", sessionError);
      return new Response(
        JSON.stringify({ error: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update progress if scenario linked
    if (session?.scenario_id && passed) {
      await supabase
        .from("user_scenario_progress")
        .upsert({
          user_id: session.user_id,
          scenario_id: session.scenario_id,
          is_completed: true,
          best_score: score,
          last_attempt_at: new Date().toISOString(),
          first_completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,scenario_id" });
    }

    return new Response(
      JSON.stringify({ success: true, score, passed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});