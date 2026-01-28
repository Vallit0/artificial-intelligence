import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, scenario_id, session_id, duration_seconds } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Get scenario details if provided
    let scenarioContext = "";
    let scenarioData = null;
    if (scenario_id) {
      const { data: scenario } = await supabase
        .from("scenarios")
        .select("*")
        .eq("id", scenario_id)
        .single();
      
      if (scenario) {
        scenarioData = scenario;
        scenarioContext = `
Escenario de práctica:
- Nombre: ${scenario.name}
- Objeción del cliente: "${scenario.objection}"
- Persona del cliente: ${scenario.client_persona}
- Dificultad: ${scenario.difficulty}
`;
      }
    }

    // Format transcript for evaluation
    const conversationText = transcript
      .map((msg: Message) => `${msg.role === "user" ? "Vendedor" : "Cliente"}: ${msg.content}`)
      .join("\n");

    // Call Lovable AI for evaluation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un evaluador experto de técnicas de ventas para "Centro de Negocios Señoriales", una empresa de espacios de trabajo compartido premium.

Tu tarea es evaluar la conversación de práctica de un vendedor y dar un puntaje de 0 a 100.

Criterios de evaluación (cada uno vale hasta 20 puntos):
1. APERTURA (20 pts): ¿El vendedor se presentó profesionalmente y estableció rapport?
2. ESCUCHA ACTIVA (20 pts): ¿Demostró entender las necesidades/objeciones del cliente?
3. MANEJO DE OBJECIONES (20 pts): ¿Respondió adecuadamente a las objeciones sin ser agresivo?
4. PROPUESTA DE VALOR (20 pts): ¿Comunicó claramente los beneficios de Señoriales?
5. CIERRE (20 pts): ¿Intentó avanzar la conversación hacia un siguiente paso concreto?

IMPORTANTE: 
- Un puntaje >= 50 significa que el vendedor PASÓ la práctica
- Sé constructivo pero justo en tu evaluación
- Considera la dificultad del escenario`,
          },
          {
            role: "user",
            content: `${scenarioContext}

Duración de la sesión: ${Math.floor(duration_seconds / 60)} minutos y ${duration_seconds % 60} segundos

Transcripción de la conversación:
${conversationText}

Evalúa esta conversación y proporciona:
1. Un puntaje total de 0-100
2. Desglose por cada criterio
3. Retroalimentación breve y constructiva (máximo 3 oraciones)

Responde ÚNICAMENTE en formato JSON:
{
  "score": <número>,
  "breakdown": {
    "apertura": <número>,
    "escucha_activa": <número>,
    "manejo_objeciones": <número>,
    "propuesta_valor": <número>,
    "cierre": <número>
  },
  "feedback": "<texto>",
  "passed": <true/false>
}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI evaluation" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI evaluation failed");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response from AI
    let evaluation;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      // Fallback evaluation
      evaluation = {
        score: 50,
        breakdown: {
          apertura: 10,
          escucha_activa: 10,
          manejo_objeciones: 10,
          propuesta_valor: 10,
          cierre: 10,
        },
        feedback: "No se pudo evaluar automáticamente. Por favor intenta de nuevo.",
        passed: false,
      };
    }

    // Ensure passed is correctly set based on score
    evaluation.passed = evaluation.score >= 50;

    // Update the practice session with the evaluation
    if (session_id) {
      await supabase
        .from("practice_sessions")
        .update({
          score: evaluation.score,
          passed: evaluation.passed,
          ai_feedback: evaluation.feedback,
        })
        .eq("id", session_id)
        .eq("user_id", user.id);
    }

    // Update user scenario progress
    if (scenario_id) {
      // Get current progress
      const { data: existingProgress } = await supabase
        .from("user_scenario_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("scenario_id", scenario_id)
        .maybeSingle();

      if (existingProgress) {
        // Update existing progress
        const updates: Record<string, unknown> = {
          attempts: existingProgress.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        };

        // Update best score if this is higher
        if (!existingProgress.best_score || evaluation.score > existingProgress.best_score) {
          updates.best_score = evaluation.score;
        }

        // Mark as completed if passed and not already completed
        if (evaluation.passed && !existingProgress.is_completed) {
          updates.is_completed = true;
          updates.first_completed_at = new Date().toISOString();
        }

        await supabase
          .from("user_scenario_progress")
          .update(updates)
          .eq("id", existingProgress.id);
      } else {
        // Create new progress entry
        await supabase.from("user_scenario_progress").insert({
          user_id: user.id,
          scenario_id: scenario_id,
          is_unlocked: true,
          is_completed: evaluation.passed,
          best_score: evaluation.score,
          attempts: 1,
          first_completed_at: evaluation.passed ? new Date().toISOString() : null,
          last_attempt_at: new Date().toISOString(),
        });
      }

      // If passed, unlock the next scenario
      if (evaluation.passed && scenarioData) {
        // Get next scenario by display_order
        const { data: nextScenario } = await supabase
          .from("scenarios")
          .select("id")
          .eq("is_active", true)
          .gt("display_order", scenarioData.display_order || 0)
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextScenario) {
          // Check if progress exists for next scenario
          const { data: nextProgress } = await supabase
            .from("user_scenario_progress")
            .select("id")
            .eq("user_id", user.id)
            .eq("scenario_id", nextScenario.id)
            .maybeSingle();

          if (nextProgress) {
            await supabase
              .from("user_scenario_progress")
              .update({ is_unlocked: true })
              .eq("id", nextProgress.id);
          } else {
            await supabase.from("user_scenario_progress").insert({
              user_id: user.id,
              scenario_id: nextScenario.id,
              is_unlocked: true,
              is_completed: false,
            });
          }
        }
      }
    }

    console.log("Evaluation complete:", evaluation);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
