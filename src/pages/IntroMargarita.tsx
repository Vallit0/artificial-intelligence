import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, Variants, useAnimationControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AICompanionOrb from "@/components/AICompanionOrb";
import logoSenoriales from "@/assets/logo-senoriales.png";

/**
 * Video de presentación de Margarita — Motion Design.
 * Muestra la UI REAL del software (vistas reales cargadas en iframes) con la
 * orbe de Margarita viajando por encima como guía.
 *
 *   /intro          → loop con controles
 *   /intro?clean=1  → sin controles (captura limpia con OBS / Win+G)
 *
 * Todas las vistas reales cargan con ?demo=1 (ver src/lib/demoMode.ts): la app
 * finge sesión admin/coach y sirve datos de demostración, así todos los
 * dashboards salen completos SIN login ni backend. No requiere sesión real.
 */

const DISPLAY = "'Nunito', 'DIN Rounded', sans-serif";
// Modo demo: las vistas cargan con ?demo=1 → sesión admin/coach falsa + datos
// de demostración (src/lib/demoMode.ts), así todo sale completo sin login ni
// backend. La llamada usa además &call=1 para entrar directo a la sesión activa.

/* ================= Variantes ================= */
const stagger = (staggerChildren = 0.07, delayChildren = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
});
// Revelado elegante (estilo Remotion): cada palabra baja desde arriba tras una
// máscara, en orden, con easing suave (sin rebote).
const wordReveal: Variants = {
  hidden: { y: "-115%" },
  show: { y: "0%", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  exit: { y: "115%", transition: { duration: 0.4, ease: [0.64, 0, 0.78, 0] } },
};
const popIn: Variants = {
  hidden: { scale: 0.4, opacity: 0, y: 20 },
  show: { scale: 1, opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 220 } },
  exit: { scale: 0.7, opacity: 0, transition: { duration: 0.25 } },
};
const fade: Variants = { hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0 } };

function Kinetic({
  text,
  className,
  wordClassName,
}: {
  text: string;
  className?: string;
  wordClassName?: (w: string, i: number) => string;
}) {
  return (
    <motion.span
      variants={stagger(0.08, 0.05)}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn("flex flex-wrap justify-center gap-x-[0.28em] gap-y-1", className)}
    >
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-flex overflow-hidden leading-[1.06] pb-[0.14em] -mb-[0.14em]">
          <motion.span variants={wordReveal} className={cn("inline-block", wordClassName?.(w, i))}>
            {w}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

function WipeBar({ color, delay = 0, className }: { color: string; delay?: number; className?: string }) {
  return (
    <motion.div
      className={cn("h-[6px] sm:h-[10px] rounded-full origin-left", color, className)}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      exit={{ scaleX: 0, originX: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
    />
  );
}

function Waveform({ bars = 7 }: { bars?: number }) {
  return (
    <div className="flex items-end gap-1.5 h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full"
          style={{ background: ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"][i % 3] }}
          animate={{ scaleY: [0.4, 1, 0.5, 0.9, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ================= Vista real (iframe de una ruta de la app) ================= */
function useFrameScale(logicalW: number, logicalH: number, maxWvw = 0.74, maxHvh = 0.64) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const calc = () =>
      setScale(Math.min((window.innerWidth * maxWvw) / logicalW, (window.innerHeight * maxHvh) / logicalH));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [logicalW, logicalH, maxWvw, maxHvh]);
  return scale;
}

// Un paso del tour guiado: localiza un elemento REAL dentro del iframe (por
// texto o selector), hace zoom y lo resalta con un spotlight + etiqueta.
type TourStep = { target?: { text?: string; selector?: string }; zoom: number; label: string };

function findTarget(doc: Document, t?: TourStep["target"]): HTMLElement | null {
  if (!t) return null;
  try {
    if (t.selector) {
      const e = doc.querySelector(t.selector) as HTMLElement | null;
      if (e) return e;
    }
    if (t.text) {
      const needle = t.text.trim().toLowerCase();
      const climb = (el: HTMLElement) =>
        (el.closest('button, a, [role="button"], [role="tab"]') as HTMLElement) ||
        (el.closest('[class*="rounded-2xl"], [class*="rounded-3xl"], [class*="rounded-xl"]') as HTMLElement) ||
        el;

      // 1) Coincidencia EXACTA del texto (la etiqueta <p> de la tarjeta),
      //    luego subimos al botón/tarjeta contenedor para resaltarlo entero.
      let best: HTMLElement | null = null;
      let bestArea = Infinity;
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>("p, span, button, a"))) {
        if ((el.textContent || "").trim().toLowerCase() === needle) {
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > 0 && area < bestArea) {
            best = el;
            bestArea = area;
          }
        }
      }
      if (best) return climb(best);

      // 2) Fallback: "includes" sobre botones/enlaces, el más pequeño.
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>('button, a, [role="button"]'))) {
        if ((el.textContent || "").toLowerCase().includes(needle)) {
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > 0 && area < bestArea) {
            best = el;
            bestArea = area;
          }
        }
      }
      return best;
    }
  } catch {
    /* cross-origin guard (no debería ocurrir en same-origin) */
  }
  return null;
}

// Simula un "click" sobre el elemento real: press + rebote.
function pressEl(el: HTMLElement, timers: ReturnType<typeof setTimeout>[]) {
  try {
    const prevT = el.style.transition;
    el.style.transition = "transform .14s ease";
    el.style.transform = "scale(0.95)";
    timers.push(setTimeout(() => (el.style.transform = "scale(1.03)"), 150));
    timers.push(
      setTimeout(() => {
        el.style.transform = "";
        el.style.transition = prevT;
      }, 430)
    );
  } catch {
    /* noop */
  }
}

function RealView({
  url,
  title,
  tour,
  dur = 6500,
  onStepFocus,
}: {
  url: string;
  title: string;
  tour?: TourStep[];
  dur?: number;
  /** Se dispara cada vez que el spotlight enfoca un elemento (para que la orbe lo "señale"). */
  onStepFocus?: () => void;
}) {
  const LW = 1280;
  const LH = 800;
  const scale = useFrameScale(LW, LH);
  const VW = LW * scale;
  const VH = LH * scale;
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [cam, setCam] = useState({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [hl, setHl] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [label, setLabel] = useState("");
  const [cursor, setCursor] = useState<{ show: boolean; click: number }>({ show: false, click: 0 });

  // Entrada escalonada de las tarjetas de modo en la vista de práctica.
  useEffect(() => {
    if (!loaded || !url.startsWith("/practice")) return;
    let cards: HTMLElement[] = [];
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      cards = Array.from(doc.querySelectorAll<HTMLElement>("button")).filter(
        (b) => b.className.includes("rounded-2xl") && b.className.includes("border-2")
      );
      cards.forEach((c) => {
        c.style.transition = "none";
        c.style.opacity = "0";
        c.style.transform = "translateY(20px) scale(0.9)";
      });
    } catch {
      return;
    }
    const timers = cards.map((c, i) =>
      setTimeout(() => {
        c.style.transition = "opacity .55s ease, transform .55s cubic-bezier(.34,1.56,.64,1)";
        c.style.opacity = "1";
        c.style.transform = "none";
      }, 250 + i * 120)
    );
    return () => timers.forEach(clearTimeout);
  }, [loaded, url]);

  // Reproduce el tour una vez que el iframe cargó: zoom → cursor entra → click.
  useEffect(() => {
    if (!loaded || !tour || tour.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const leadIn = 900;
    const per = Math.max(2500, (dur - leadIn) / tour.length);

    setCam({ cx: 0.5, cy: 0.5, zoom: 1 });
    setHl(null);
    setLabel(tour[0]?.label ?? "");
    setCursor({ show: false, click: 0 });

    tour.forEach((step, i) => {
      const base = leadIn + i * per;
      timers.push(
        setTimeout(() => {
          const doc = iframeRef.current?.contentDocument ?? null;
          const el = doc ? findTarget(doc, step.target) : null;
          if (!el) {
            setCam({ cx: 0.5, cy: 0.5, zoom: 1 });
            setHl(null);
            setLabel(step.label);
            setCursor({ show: false, click: 0 });
            return;
          }
          // Pantalla FIJA: no hacemos scrollIntoView — desplazaba el contenido
          // del iframe y "movía la pantalla" durante la presentación. El
          // spotlight se dibuja sobre la posición actual del elemento.
          const clickable = el.matches('button, a, [role="button"], [role="tab"]');
          // Enfoca (zoom + spotlight)
          timers.push(
            setTimeout(() => {
              const r = el.getBoundingClientRect();
              // Pantalla fija: no movemos la cámara, solo el spotlight sobre la vista.
              setHl({ x: r.left / LW, y: r.top / LH, w: r.width / LW, h: r.height / LH });
              setLabel(step.label);
              onStepFocus?.(); // la orbe reacciona: se inclina y brinca señalando
            }, 90)
          );
          if (clickable) {
            // El cursor entra...
            timers.push(setTimeout(() => setCursor({ show: true, click: 0 }), 720));
            // ...y hace click sobre el botón real (rebote + sonido)
            timers.push(
              setTimeout(() => {
                setCursor((c) => ({ show: true, click: c.click + 1 }));
                pressEl(el, timers);
              }, 1150)
            );
          } else {
            setCursor({ show: false, click: 0 });
          }
        }, base)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [loaded, tour, dur, scale]);

  return (
    <motion.div
      variants={fade}
      initial="hidden"
      animate="show"
      exit="exit"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-6"
    >
      <div style={{ fontFamily: DISPLAY }} className="mb-1">
        <Kinetic
          key={title}
          text={title}
          className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight drop-shadow-[0_6px_16px_rgba(90,60,160,0.18)]"
        />
      </div>

      <motion.div
        className="rounded-2xl overflow-hidden bg-card shadow-soft border border-border"
        style={{ width: VW }}
        initial={{ y: 60, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -40, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 20, stiffness: 120 }}
      >
        {/* Chrome del navegador */}
        <div className="flex items-center gap-2 px-4 h-9 bg-muted/60 border-b border-border">
          <span className="w-3 h-3 rounded-full bg-destructive/70" />
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--gold))]" />
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--lime))]" />
          <span className="ml-3 text-xs text-muted-foreground font-medium truncate">
            centro-de-negocios.org{url.split("?")[0]}
          </span>
        </div>

        {/* Viewport con cámara (zoom/pan) + spotlight */}
        <div style={{ width: VW, height: VH, overflow: "hidden", position: "relative" }}>
          <motion.div
            style={{ width: VW, height: VH, transformOrigin: "0px 0px" }}
            animate={{
              scale: cam.zoom,
              x: VW / 2 - cam.cx * VW * cam.zoom,
              y: VH / 2 - cam.cy * VH * cam.zoom,
            }}
            transition={{ type: "spring", damping: 28, stiffness: 65 }}
          >
            <div style={{ width: LW, height: LH, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
              <iframe
                ref={iframeRef}
                src={`${url}${url.includes("?") ? "&" : "?"}demo=1`}
                title={title}
                onLoad={() => setLoaded(true)}
                style={{ width: LW, height: LH, border: 0, opacity: loaded ? 1 : 0, transition: "opacity .5s" }}
              />
            </div>
            {hl && (
              <motion.div
                className="pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  left: hl.x * VW,
                  top: hl.y * VH,
                  width: hl.w * VW,
                  height: hl.h * VH,
                }}
                transition={{ type: "spring", damping: 26, stiffness: 170 }}
                style={{
                  position: "absolute",
                  border: "3px solid hsl(var(--primary))",
                  borderRadius: 16,
                  boxShadow: "0 0 0 2000px rgba(20,10,40,0.45)",
                }}
              />
            )}
          </motion.div>

          {/* Etiqueta del paso (fuera de la cámara, siempre legible) */}
          <AnimatePresence mode="wait">
            {tour && label && (
              <motion.div
                key={label}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm sm:text-base font-bold shadow-xl max-w-[85%] text-center"
                style={{ fontFamily: DISPLAY }}
              >
                {label}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulso de "click" (sin cursor): anillo que late sobre el elemento enfocado */}
          {cursor.show && cursor.click > 0 && hl && (
            <motion.span
              key={cursor.click}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: (hl.x + hl.w / 2) * VW,
                top: (hl.y + hl.h / 2) * VH,
                width: 56,
                height: 56,
                marginLeft: -28,
                marginTop: -28,
                border: "3px solid hsl(var(--primary))",
              }}
              initial={{ scale: 0.3, opacity: 0.7 }}
              animate={{ scale: 2.7, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ================= Timeline ================= */
type SceneKey =
  | "intro" | "meet" | "talk" | "modes" | "call" | "call2"
  | "landing" | "practice" | "prospecting" | "progress"
  | "outro";

const SCENES: { key: SceneKey; dur: number; url?: string; title?: string }[] = [
  { key: "intro", dur: 4200 },
  { key: "meet", dur: 4000 },
  { key: "talk", dur: 4600 },
  { key: "landing", dur: 5000, url: "/", title: "¿Listo para proteger más familias?" },
  { key: "modes", dur: 6200 },
  { key: "practice", dur: 11500, url: "/practice", title: "¿Te animas al Role-Play?" },
  { key: "call", dur: 5800 },
  { key: "prospecting", dur: 8500, url: "/prospecting", title: "¿Y si tocas esa puerta?" },
  { key: "call2", dur: 5800 },
  { key: "progress", dur: 11000, url: "/progress", title: "¿Cómo has progresado?" },
  { key: "outro", dur: 5000 },
];

const ORB_POSES: Record<
  SceneKey,
  {
    x: string | number;
    y: string | number;
    scale: number;
    opacity: number;
    speaking?: boolean;
    listening?: boolean;
    excited?: boolean;
    look?: { x: number; y: number };
  }
> = {
  intro: { x: 0, y: 0, scale: 0, opacity: 0 },
  // Mira hacia abajo, al texto que cae/se mueve debajo de ella.
  meet: { x: 0, y: "-4vh", scale: 1.1, opacity: 1, excited: true, look: { x: 0, y: 1 } }, // feliz de conocerte
  talk: { x: 0, y: "-14vh", scale: 0.85, opacity: 1, speaking: true, look: { x: 0, y: 1 } },
  modes: { x: 0, y: "-16vh", scale: 0.8, opacity: 1, speaking: true, excited: true, look: { x: 0, y: 1 } },
  call: { x: 0, y: 0, scale: 0.3, opacity: 0 }, // la escena de llamada trae su propia orbe
  call2: { x: 0, y: 0, scale: 0.3, opacity: 0 },
  landing: { x: 0, y: 0, scale: 0.3, opacity: 0 }, // la vista real ya trae la orbe
  practice: { x: 0, y: 0, scale: 0.3, opacity: 0 }, // la vista real ya trae la orbe
  // Orbe en la esquina, emocionada y mirando hacia la demo (al centro).
  prospecting: { x: "-42vw", y: "-30vh", scale: 0.42, opacity: 1, excited: true, look: { x: 1, y: 0.35 } },
  progress: { x: "42vw", y: "-30vh", scale: 0.42, opacity: 1, excited: true, look: { x: -1, y: 0.35 } },
  outro: { x: 0, y: "-16vh", scale: 0.6, opacity: 1, excited: true, look: { x: 0, y: 0.9 } },
};

const TALK = ["Hola,", "soy", "Margarita."];

// "Practica" queda estático; solo cambia la segunda parte.
const MODES: { t: string; c: string }[] = [
  { t: "Objeciones", c: "text-accent" },
  { t: "Prospección", c: "text-secondary" },
  { t: "con tu Coach", c: "text-primary" },
];

// Tour guiado de la vista de práctica (/practice): zoom + resalte sobre los
// botones reales. Los targets se localizan por su texto dentro del iframe;
// si alguno no existe, ese paso muestra la vista completa con su etiqueta.
const PRACTICE_TOUR: TourStep[] = [
  { zoom: 1, label: "Elige cómo quieres practicar hoy" },
  { target: { text: "Coach" }, zoom: 1.9, label: "Feedback y tips en tiempo real" },
  { target: { text: "Escenarios de Prospección" }, zoom: 1.85, label: "Prospección presencial y en campo" },
  { target: { text: "Role-Play Cliente" }, zoom: 1.9, label: "Practica una llamada con un cliente que objeta" },
];

const PROSPECTING_TOUR: TourStep[] = [
  { zoom: 1, label: "Escenarios de prospección en campo" },
  { target: { text: "Señora en Frutas y Verduras" }, zoom: 1.6, label: "Casos reales de la calle" },
  { target: { text: "Iniciar Práctica" }, zoom: 1.9, label: "Practica el abordaje en un clic" },
];

const PROGRESS_TOUR: TourStep[] = [
  { zoom: 1, label: "Tu progreso, medido" },
  { target: { text: "Tiempo Total" }, zoom: 1.9, label: "Tiempo total de práctica" },
  { target: { text: "Días de racha" }, zoom: 1.9, label: "Mantén tu racha diaria" },
  { target: { text: "Sesiones Recientes" }, zoom: 1.7, label: "El historial de cada sesión" },
];


/* ================= Componente principal ================= */
const IntroMargarita = () => {
  const navigate = useNavigate();
  const clean = new URLSearchParams(window.location.search).has("clean");

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [talkStep, setTalkStep] = useState(0);
  const [modeStep, setModeStep] = useState(0);
  // Alterna la mirada entre la cámara (a ti) y el contenido de la escena.
  const [gazeCamera, setGazeCamera] = useState(true);

  const scene = SCENES[i].key;
  const pose = ORB_POSES[scene];

  // Escenas de "personaje" (Margarita hablándote de frente): alterna mirada cámara ↔ contenido.
  const talky = scene === "meet" || scene === "talk" || scene === "modes" || scene === "outro";
  const effLook = talky && gazeCamera ? { x: 0, y: 0 } : pose.look ?? null;

  // "Señalar": la orbe se inclina + brinca hacia donde mira cuando el spotlight
  // salta a un botón. Dirección = hacia donde apunta su mirada en la escena.
  const pointControls = useAnimationControls();
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const handleStepFocus = useCallback(() => {
    const dir = Math.sign(poseRef.current.look?.x ?? 1) || 1;
    pointControls.start({
      rotate: [0, 11 * dir, -4 * dir, 0],
      y: [0, -26, 0, 0],
      scale: [1, 1.14, 0.98, 1],
      transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.35, 0.7, 1] },
    });
  }, [pointControls]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((p) => (p + 1) % SCENES.length), SCENES[i].dur);
    return () => clearTimeout(t);
  }, [i, paused]);

  useEffect(() => {
    if (scene !== "talk") {
      setTalkStep(0);
      return;
    }
    const id = setInterval(() => setTalkStep((s) => Math.min(s + 1, TALK.length)), 800);
    return () => clearInterval(id);
  }, [scene]);

  // Alterna la mirada: arranca a cámara (conecta contigo) y cada ~1.7s
  // baja a ver el texto, luego vuelve. Solo en escenas de personaje.
  useEffect(() => {
    if (!talky) {
      setGazeCamera(false);
      return;
    }
    setGazeCamera(true);
    const id = setInterval(() => setGazeCamera((g) => !g), 1700);
    return () => clearInterval(id);
  }, [scene, talky]);

  // Ciclo de los textos grandes de modos.
  useEffect(() => {
    if (scene !== "modes") {
      setModeStep(0);
      return;
    }
    const id = setInterval(() => setModeStep((s) => Math.min(s + 1, MODES.length - 1)), 1900);
    return () => clearInterval(id);
  }, [scene]);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative flex items-center justify-center">
      {/* Fondo parallax */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute -top-[12%] -left-[8%] w-[42vw] h-[42vw] rounded-full bg-primary/15 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[10%] -right-[6%] w-[36vw] h-[36vw] rounded-full bg-secondary/15 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-[14%] left-[22%] w-[34vw] h-[34vw] rounded-full bg-accent/15 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Orbe viajera */}
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ x: pose.x, y: pose.y, scale: pose.scale, opacity: pose.opacity }}
          transition={{ type: "spring", damping: 22, stiffness: 90 }}
        >
          <motion.div animate={pointControls} style={{ transformOrigin: "center bottom" }}>
            <AICompanionOrb
              size="lg"
              speaking={!!pose.speaking}
              listening={!!pose.listening}
              excited={!!pose.excited}
              lookAt={effLook}
            />
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {/* INTRO */}
        {scene === "intro" && (
          <motion.div key="intro" variants={fade} initial="hidden" animate="show" exit="exit" className="relative z-30 flex flex-col items-center text-center gap-6 px-6">
            <motion.img src={logoSenoriales} alt="Señoriales" className="h-20 w-auto" variants={popIn} initial="hidden" animate="show" exit="exit" />
            <h1 className="text-4xl sm:text-6xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: DISPLAY }}>
              <Kinetic text="Centro de Negocios" />
              <Kinetic text="Señoriales" className="mt-1" wordClassName={() => "text-primary"} />
            </h1>
            <div className="w-40 sm:w-56"><WipeBar color="bg-gradient-to-r from-secondary via-primary to-accent" delay={0.6} /></div>
            <motion.p className="text-base sm:text-lg font-semibold text-muted-foreground" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.9 }}>
              Entrenamiento de ventas con Inteligencia Artificial
            </motion.p>
          </motion.div>
        )}

        {/* MEET */}
        {scene === "meet" && (
          <motion.div key="meet" variants={fade} initial="hidden" animate="show" exit="exit" className="absolute inset-x-0 bottom-[13vh] z-50 flex flex-col items-center text-center gap-4 px-6">
            <motion.p
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-bold uppercase tracking-[0.28em] shadow-xl"
              initial={{ y: "-58vh", opacity: 0, rotate: -8 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 9, stiffness: 130, delay: 0.15 }}
            >
              Tu coach personal de ventas
            </motion.p>
            <h1 className="text-5xl sm:text-8xl font-extrabold text-foreground tracking-tight leading-[0.95]" style={{ fontFamily: DISPLAY }}>
              <Kinetic text="Conoce a" />
              <Kinetic text="Margarita" className="mt-1" wordClassName={() => "text-secondary"} />
            </h1>
          </motion.div>
        )}

        {/* TALK */}
        {scene === "talk" && (
          <motion.div key="talk" variants={fade} initial="hidden" animate="show" exit="exit" className="absolute inset-x-0 bottom-[18vh] z-30 flex flex-col items-center text-center gap-6 px-6">
            <div className="text-4xl sm:text-7xl font-extrabold text-foreground tracking-tight flex flex-wrap justify-center gap-x-4 min-h-[1.2em]" style={{ fontFamily: DISPLAY }}>
              <AnimatePresence>
                {TALK.slice(0, talkStep).map((w, idx) => (
                  <motion.span key={w} className={cn("inline-block", idx === 2 && "text-primary")} initial={{ y: "115%", opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: 0, transition: { type: "spring", damping: 12, stiffness: 200 } }}>
                    {w}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <Waveform bars={9} />
          </motion.div>
        )}

        {/* MODES — textos grandes anunciando los modos de práctica */}
        {scene === "modes" && (
          <motion.div
            key="modes"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-x-0 bottom-[15vh] z-30 flex flex-col items-center text-center px-6"
            style={{ fontFamily: DISPLAY }}
          >
            <motion.span
              className="text-5xl sm:text-8xl font-extrabold text-foreground tracking-tight leading-[0.95]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              Practica
            </motion.span>
            <AnimatePresence mode="wait">
              <Kinetic
                key={modeStep}
                text={MODES[modeStep].t}
                className={cn(
                  "text-5xl sm:text-8xl font-extrabold tracking-tight leading-[0.95] mt-1",
                  MODES[modeStep].c
                )}
              />
            </AnimatePresence>
          </motion.div>
        )}

        {/* VISTAS REALES (iframes con ?demo=1 → datos de demostración) */}
        {scene === "call" && (
          <RealView key="call" url="/practice?call=1" title="¿Escuchas cómo suena?" />
        )}
        {scene === "call2" && (
          <RealView key="call2" url="/practice?call=1&persona=Cliente%20en%20campo" title="¿Escuchas cómo suena?" />
        )}
        {scene === "landing" && <RealView key="landing" url="/" title="¿Listo para proteger más familias?" />}
        {scene === "practice" && (
          <RealView key="practice" url="/practice" title="¿Te animas al Role-Play?" tour={PRACTICE_TOUR} dur={11500} onStepFocus={handleStepFocus} />
        )}
        {scene === "prospecting" && (
          <RealView key="prospecting" url="/prospecting" title="¿Y si tocas esa puerta?" tour={PROSPECTING_TOUR} dur={8500} onStepFocus={handleStepFocus} />
        )}
        {scene === "progress" && (
          <RealView key="progress" url="/progress" title="¿Cómo has progresado?" tour={PROGRESS_TOUR} dur={11000} onStepFocus={handleStepFocus} />
        )}

        {/* OUTRO */}
        {scene === "outro" && (
          <motion.div key="outro" variants={fade} initial="hidden" animate="show" exit="exit" className="absolute inset-x-0 bottom-[14vh] z-30 flex flex-col items-center text-center gap-4 px-6">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: DISPLAY }}>
              <Kinetic text="Centro de Negocios" />
              <Kinetic text="Señoriales" className="mt-1" wordClassName={() => "text-primary"} />
            </h1>
            <div className="w-48"><WipeBar color="bg-gradient-to-r from-accent via-primary to-secondary" delay={0.5} /></div>
            <motion.p className="text-lg font-semibold text-muted-foreground" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              Entrena. Practica. Protege familias.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de progreso */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 h-1 z-40">
        {SCENES.map((s, idx) => (
          <div key={s.key} className="flex-1 h-full bg-primary/10 overflow-hidden">
            <motion.div className="h-full bg-primary" initial={false} animate={{ width: idx < i ? "100%" : idx === i && !paused ? "100%" : "0%" }} transition={{ duration: idx === i && !paused ? SCENES[i].dur / 1000 : 0, ease: "linear" }} />
          </div>
        ))}
      </div>

      {/* Controles */}
      {!clean && (
        <div className="absolute bottom-6 right-6 flex gap-2 z-40">
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>{paused ? "▶ Reproducir" : "⏸ Pausar"}</Button>
          <Button variant="outline" size="sm" onClick={() => { setPaused(false); setI(0); }}>⟲ Reiniciar</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Salir</Button>
        </div>
      )}
    </div>
  );
};

export default IntroMargarita;
