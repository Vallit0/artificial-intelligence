// ============================================
// Session Evaluation (OpenAI-backed)
// ============================================
// Scores a sales-practice transcript across 5 competencies and returns a
// pass/fail decision the frontend uses to gate progression. Falls back to a
// neutral evaluation if the model is unreachable, so a transient OpenAI
// outage does not strand the student on the "evaluating..." screen.

import config from '../config/index.js';
import { z } from 'zod';
import prisma from '../db/index.js';
import { getLogger } from '../utils/logger.js';
import { SessionEvaluation } from '../types/index.js';

const log = getLogger({ component: 'evaluation' });

export interface TranscriptTurn {
  role: string;
  content: string;
}

const PASS_THRESHOLD = 75;
const MIN_TURNS_FOR_REAL_EVAL = 4; // need actual back-and-forth to score

const evaluationSchema = z.object({
  apertura: z.number().min(0).max(20),
  escucha_activa: z.number().min(0).max(20),
  manejo_objeciones: z.number().min(0).max(20),
  propuesta_valor: z.number().min(0).max(20),
  cierre: z.number().min(0).max(20),
  feedback: z.string().min(1).max(800),
});

// For practice sessions (with a scenarioId) we keep the lenient fallback so a
// transient OpenAI outage does not strand the student. For the final exam
// (scenarioId == null) we MUST NOT pass automatically — that would let any
// student promote to Level 2 just by triggering a network error.
function neutralEvaluation(reason: string, isExam: boolean): SessionEvaluation {
  if (isExam) {
    return {
      score: 0,
      passed: false,
      feedback: `No pudimos evaluar tu examen automáticamente (${reason}). Volvé a intentarlo en unos minutos. Si el problema persiste, contactá a tu instructor.`,
      breakdown: {
        apertura: 0,
        escucha_activa: 0,
        manejo_objeciones: 0,
        propuesta_valor: 0,
        cierre: 0,
      },
      evaluationStatus: 'fallback_exam',
    };
  }
  return {
    score: 50,
    passed: true,
    feedback: `Sesión registrada. Evaluación automática no disponible (${reason}). Tu instructor revisará los detalles.`,
    breakdown: {
      apertura: 10,
      escucha_activa: 10,
      manejo_objeciones: 10,
      propuesta_valor: 10,
      cierre: 10,
    },
    evaluationStatus: 'fallback_practice',
  };
}

function tooShortEvaluation(): SessionEvaluation {
  return {
    score: 0,
    passed: false,
    feedback: 'La sesión terminó muy rápido para poder evaluar tus habilidades. Volvé a intentarlo y desarrollá la conversación al menos por 1 minuto.',
    breakdown: {
      apertura: 0,
      escucha_activa: 0,
      manejo_objeciones: 0,
      propuesta_valor: 0,
      cierre: 0,
    },
    evaluationStatus: 'too_short',
  };
}

function buildSystemPrompt(): string {
  return `Eres un evaluador experto de habilidades de ventas para previsión funeraria (Corporación Señoriales).

Tu tarea: leer un transcript de práctica entre un asesor (estudiante) y un cliente simulado por IA, y devolver un puntaje sobre 5 competencias.

Cada competencia se puntúa 0–20:
- apertura: cómo se presentó y captó atención al inicio.
- escucha_activa: si parafraseó, hizo preguntas abiertas, reconoció emociones.
- manejo_objeciones: si neutralizó objeciones (no me interesa, no tengo dinero, etc.) sin discutir, con empatía y argumentos sólidos.
- propuesta_valor: si comunicó beneficios concretos del producto (capilla, prevención, paz familiar) en lenguaje del cliente.
- cierre: si avanzó hacia un compromiso (cita, llamada, decisión) o cedió control.

Reglas:
- Solo evalúa lo que está EN el transcript. No inventes.
- Si el asesor no llegó a una competencia, ese rubro va bajo (0–5).
- feedback: máximo 3 oraciones en español rioplatense neutro, accionable, sin elogios vacíos.
- Devuelve SOLO JSON con los 5 números y el feedback. Nada más.`;
}

function formatTranscript(transcript: TranscriptTurn[]): string {
  return transcript
    .map((t) => {
      const speaker = t.role === 'user' ? 'ASESOR' : 'CLIENTE';
      return `${speaker}: ${t.content}`;
    })
    .join('\n');
}

async function fetchScenarioContext(scenarioId?: string | null): Promise<string | null> {
  if (!scenarioId) return null;
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { name: true, objection: true, description: true },
    });
    if (!scenario) return null;
    return `Escenario: ${scenario.name}. Objeción a manejar: "${scenario.objection}". ${scenario.description}`;
  } catch {
    return null;
  }
}

export async function evaluateSession(
  transcript: TranscriptTurn[],
  scenarioId?: string | null,
): Promise<SessionEvaluation> {
  // No scenarioId means this is the final exam (the only session created
  // without a scenario). The fallback policy is stricter for exams — see
  // neutralEvaluation.
  const isExam = !scenarioId;

  if (!Array.isArray(transcript) || transcript.length < MIN_TURNS_FOR_REAL_EVAL) {
    return tooShortEvaluation();
  }

  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    log.warn('OPENAI_API_KEY not set — returning neutral evaluation');
    return neutralEvaluation('IA no configurada', isExam);
  }

  const scenarioContext = await fetchScenarioContext(scenarioId);
  const formatted = formatTranscript(transcript);

  const userMessage = scenarioContext
    ? `${scenarioContext}\n\nTranscript:\n${formatted}`
    : `Transcript (sin escenario específico — sesión libre):\n${formatted}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.openai.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userMessage },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.warn({ status: res.status, body: body.slice(0, 200) }, 'OpenAI returned non-2xx');
      return neutralEvaluation('error temporal del modelo', isExam);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      log.warn('OpenAI returned empty completion');
      return neutralEvaluation('respuesta vacía', isExam);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      log.warn({ content: content.slice(0, 200) }, 'OpenAI returned non-JSON despite response_format');
      return neutralEvaluation('respuesta inválida', isExam);
    }

    const validated = evaluationSchema.safeParse(parsed);
    if (!validated.success) {
      log.warn({ issues: validated.error.issues }, 'OpenAI response failed schema validation');
      return neutralEvaluation('respuesta con formato inválido', isExam);
    }

    const breakdown = {
      apertura: Math.round(validated.data.apertura),
      escucha_activa: Math.round(validated.data.escucha_activa),
      manejo_objeciones: Math.round(validated.data.manejo_objeciones),
      propuesta_valor: Math.round(validated.data.propuesta_valor),
      cierre: Math.round(validated.data.cierre),
    };
    const score = breakdown.apertura + breakdown.escucha_activa + breakdown.manejo_objeciones + breakdown.propuesta_valor + breakdown.cierre;

    return {
      score,
      passed: score >= PASS_THRESHOLD,
      feedback: validated.data.feedback,
      breakdown,
      evaluationStatus: 'real',
    };
  } catch (err) {
    log.warn({ err }, 'OpenAI evaluation failed');
    return neutralEvaluation('error de red', isExam);
  }
}
