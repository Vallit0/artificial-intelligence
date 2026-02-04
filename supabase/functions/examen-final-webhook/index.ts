import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExamenEvaluationPayload {
  session_id: string;
  score: number;
  passed: boolean;
  feedback: string;
  apertura?: number;
  escucha_activa?: number;
  manejo_objeciones?: number;
  propuesta_valor?: number;
  cierre?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ExamenEvaluationPayload = await req.json();
    
    console.log("Received Examen Final evaluation webhook:", payload);

    const { session_id, score, passed, feedback, apertura, escucha_activa, manejo_objeciones, propuesta_valor, cierre } = payload;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build breakdown object if individual scores provided
    const breakdown = (apertura !== undefined || escucha_activa !== undefined) ? {
      apertura: apertura ?? 0,
      escucha_activa: escucha_activa ?? 0,
      manejo_objeciones: manejo_objeciones ?? 0,
      propuesta_valor: propuesta_valor ?? 0,
      cierre: cierre ?? 0,
    } : null;

    // Update the practice session with the evaluation
    const { data: session, error: sessionError } = await supabase
      .from("practice_sessions")
      .update({
        score,
        passed,
        ai_feedback: feedback,
      })
      .eq("id", session_id)
      .select("user_id, scenario_id")
      .single();

    if (sessionError) {
      console.error("Error updating session:", sessionError);
      return new Response(
        JSON.stringify({ error: sessionError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Updated Examen Final session:", session);

    // Update user progress if scenario linked
    if (session?.scenario_id) {
      await supabase
        .from("user_scenario_progress")
        .upsert({
          user_id: session.user_id,
          scenario_id: session.scenario_id,
          is_completed: passed,
          best_score: score,
          last_attempt_at: new Date().toISOString(),
          first_completed_at: passed ? new Date().toISOString() : null,
        }, {
          onConflict: "user_id,scenario_id",
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Examen Final evaluation saved",
        score,
        passed,
        feedback,
        breakdown,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing Examen Final webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
