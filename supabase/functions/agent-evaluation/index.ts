import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EvaluationPayload {
  session_id: string;
  score: number;
  passed: boolean;
  feedback: string;
  breakdown?: {
    apertura: number;
    escucha_activa: number;
    manejo_objeciones: number;
    propuesta_valor: number;
    cierre: number;
  };
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

    const payload: EvaluationPayload = await req.json();
    
    console.log("Received evaluation from ElevenLabs agent:", payload);

    const { session_id, score, passed, feedback, breakdown } = payload;

    if (!session_id) {
      throw new Error("session_id is required");
    }

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
      throw sessionError;
    }

    console.log("Updated session:", session);

    // Update user progress
    if (session.scenario_id) {
      // Update current scenario progress
      const { error: progressError } = await supabase
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

      if (progressError) {
        console.error("Error updating progress:", progressError);
      }

      // If passed, unlock next scenario
      if (passed) {
        // Get current scenario's display_order
        const { data: currentScenario } = await supabase
          .from("scenarios")
          .select("display_order")
          .eq("id", session.scenario_id)
          .single();

        if (currentScenario) {
          // Find next scenario
          const { data: nextScenario } = await supabase
            .from("scenarios")
            .select("id")
            .gt("display_order", currentScenario.display_order || 0)
            .order("display_order", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (nextScenario) {
            // Unlock next scenario
            await supabase.from("user_scenario_progress").upsert(
              {
                user_id: session.user_id,
                scenario_id: nextScenario.id,
                is_unlocked: true,
              },
              { onConflict: "user_id,scenario_id" }
            );
            console.log("Unlocked next scenario:", nextScenario.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score,
        passed,
        feedback,
        breakdown,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing evaluation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
