import { Sunrise } from "lucide-react";

// Ícono del módulo. Deliberadamente NO es una llama (se percibe tétrico): un
// amanecer transmite calma, luz y un nuevo comienzo, que es el tono de la
// campaña. Cambiarlo aquí lo cambia en toda la app.
export const CremacionIcon = Sunrise;

// Paleta del módulo Cremación. Misma estructura visual que Prospección /
// Objeciones, pero en tono anaranjado para que el usuario note de inmediato
// que está entrenando la línea de producto Cremación.

// Acento para sidebar / nav móvil / badges.
export const CREMACION_ACCENT_BG = "linear-gradient(135deg, #f97316, #f59e0b)";

// Orbe de Margarita en Cremación.
export const CREMACION_ORB_GRADIENT =
  "linear-gradient(135deg, #c2410c 0%, #f97316 40%, #fdba74 70%, #ea580c 100%)";

// Badge de módulo en la pantalla de práctica.
export const CREMACION_BADGE_CLASS =
  "bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-500/30";

// Colores de las tarjetas (gradiente + borde), por id de tarjeta. Todas en la
// familia naranja/ámbar con distinta intensidad para que sigan siendo
// distinguibles entre sí.
export const CREMACION_CARD_COLORS: Record<string, string> = {
  coach: "from-orange-500/20 to-orange-500/5 border-orange-500/40 hover:border-orange-500/70",
  "roleplay-cliente": "from-amber-500/20 to-amber-500/5 border-amber-500/40 hover:border-amber-500/70",
  "roleplay-asesor": "from-orange-700/20 to-orange-700/5 border-orange-700/40 hover:border-orange-700/70",
  productos: "from-orange-400/25 to-amber-300/10 border-orange-400/50 hover:border-orange-400/80",
  dudas: "from-amber-400/25 to-yellow-300/10 border-amber-400/50 hover:border-amber-400/80",
};

export const CREMACION_CARD_FALLBACK =
  "from-orange-500/15 to-orange-500/5 border-orange-500/30 hover:border-orange-500/60";

// Sufijo que se agrega al secret name del agente cuando la pista es Cremación.
// Ej: ELEVENLABS_AGENT_COACH            -> ELEVENLABS_AGENT_COACH_CREMACION
//     ELEVENLABS_AGENT_COACH_NIVEL2     -> ELEVENLABS_AGENT_COACH_NIVEL2_CREMACION
// Mientras el admin no configure el agente con ese nombre, el backend cae al
// agente default (ver resolveAgent), así que el mockup sigue conectando.
export const CREMACION_AGENT_SUFFIX = "_CREMACION";
