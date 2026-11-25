// ============================================
// DEMO MODE (solo para el video de presentación /intro)
// ============================================
// Cuando una vista se carga con ?demo=1 (dentro de los iframes de /intro),
// la app finge una sesión admin/coach y el api-client responde con estos
// datos de demostración — así todos los dashboards aparecen completos y
// poblados, sin backend ni login. Fuera de ?demo=1, la app funciona normal.
//
// NOTA: rama desechable — este archivo es solo para producir el video.

import type { ApiUser } from "@/lib/api-client";

export const DEMO =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("demo");

export const DEMO_ROLES = ["learner", "coach", "admin"];

export const DEMO_USER: ApiUser = {
  id: "demo-user",
  email: "ana.garcia@senoriales.com",
  firstName: "Ana",
  lastName: "García",
  examenFinalEnabled: true,
  examenObjecionesEnabled: true,
  // Nivel 1 para que la vista de práctica muestre las 5 tarjetas de modo
  // (incluida "Escenarios de Prospección", oculta en Nivel 2).
  level2Unlocked: false,
  courseCompleted: false,
  tutorialCompleted: true,
  sede: { id: "sede-gt", name: "Guatemala HQ" },
  coach: { id: "coach-1", name: "Coach Margarita" },
  division: { id: "div-1", name: "Equipo Ventas A" },
  coachPermissions: {
    canCreateCoaches: true,
    canEditPrompts: true,
    canAccessAdmin: true,
  },
};

// ---- helpers ----
const SEDES = [
  { id: "sede-gt", slug: "guatemala", name: "Guatemala HQ", country: "Guatemala", city: "Ciudad de Guatemala" },
  { id: "sede-sv", slug: "san-salvador", name: "San Salvador", country: "El Salvador", city: "San Salvador" },
  { id: "sede-hn", slug: "tegucigalpa", name: "Tegucigalpa", country: "Honduras", city: "Tegucigalpa" },
];

const NAMES: [string, string][] = [
  ["Ana", "García"], ["Luis", "Morales"], ["Sofía", "Ramírez"], ["Carlos", "Herrera"],
  ["María", "López"], ["Diego", "Castillo"], ["Valeria", "Cruz"], ["Jorge", "Méndez"],
  ["Paola", "Reyes"], ["Andrés", "Flores"], ["Camila", "Vargas"], ["Roberto", "Díaz"],
];

function dateBack(daysAgo: number): string {
  const base = new Date("2026-06-30T12:00:00Z");
  const d = new Date(base);
  d.setDate(base.getDate() - daysAgo);
  return d.toISOString();
}
function dayBack(daysAgo: number): string {
  return dateBack(daysAgo).slice(0, 10);
}

// Sesiones (GET /api/sessions) — camelCase (backend shape)
const MODES = ["cliente_prospeccion", "cliente", "objeciones", "asesor", "coach"];
const SESSIONS = Array.from({ length: 16 }).map((_, i) => {
  const score = 68 + ((i * 13) % 30);
  return {
    id: `sess-${i}`,
    userId: "demo-user",
    durationSeconds: 180 + ((i * 47) % 420),
    rating: 3 + (i % 3),
    score,
    passed: score >= 75,
    aiFeedback: "Buena apertura y manejo de objeciones. Trabaja el cierre.",
    scenarioId: `sc${(i % 5) + 1}`,
    practiceMode: MODES[i % MODES.length],
    examType: i % 3 === 0 ? "prospeccion" : i % 3 === 1 ? "objeciones" : null,
    createdAt: dateBack(i * 2),
  };
});

const BREAKDOWN = { apertura: 88, escuchaActiva: 82, manejoObjeciones: 76, propuestaValor: 80, cierre: 73 };

// Estudiantes (GET /api/admin/students)
const STUDENTS = NAMES.map(([fn, ln], i) => {
  const sede = SEDES[i % SEDES.length];
  const avg = 70 + ((i * 7) % 25);
  return {
    id: `stu-${i}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@senoriales.com`,
    firstName: fn,
    lastName: ln,
    createdAt: dateBack(120 - i * 5),
    totalSessions: 6 + ((i * 3) % 22),
    totalDuration: 1800 + ((i * 640) % 9000),
    averageScore: avg,
    bestExamScore: Math.min(98, avg + 12),
    bestProspeccionScore: Math.min(98, avg + 10),
    bestObjecionesScore: Math.min(95, avg + 4),
    examAttempts: 1 + (i % 4),
    finalGrade: i % 3 === 0 ? Math.min(100, avg + 8) : null,
    gradedAt: dateBack(10 + i),
    examenFinalEnabled: true,
    examenObjecionesEnabled: i % 2 === 0,
    level2Unlocked: i % 2 === 0,
    courseCompleted: i % 5 === 0,
    phoneNumber: `+502 5${(1000 + i).toString()} ${(2000 + i * 3).toString()}`,
    sedeId: sede.id,
    sedeName: sede.name,
    country: sede.country,
    coachId: `coach-${(i % 3) + 1}`,
    coachName: ["Coach Margarita", "Coach Marta", "Coach René"][i % 3],
    divisionId: `div-${(i % 4) + 1}`,
    divisionName: ["Equipo Ventas A", "Equipo Ventas B", "Corporativo", "Retail"][i % 4],
  };
});

const DIVISIONS = ["Equipo Ventas A", "Equipo Ventas B", "Corporativo", "Retail"].map((name, i) => ({
  id: `div-${i + 1}`,
  name,
  isActive: true,
  createdAt: dateBack(150),
  sede: SEDES[i % SEDES.length],
  coach: { id: `coach-${(i % 3) + 1}`, name: ["Coach Margarita", "Coach Marta", "Coach René"][i % 3], email: "coach@senoriales.com" },
  learnerCount: 5 + i * 2,
}));

const COACHES = ["Margarita", "Marta", "René", "Lucía"].map((fn, i) => ({
  id: `coach-${i + 1}`,
  email: `${fn.toLowerCase()}@senoriales.com`,
  firstName: fn,
  lastName: ["Pérez", "Solís", "Aguilar", "Bonilla"][i],
  createdAt: dateBack(200),
  sede: SEDES[i % SEDES.length],
  permissions: { canCreateCoaches: i === 0, canEditPrompts: true, canAccessAdmin: i === 0, grantedBy: "admin", updatedAt: dateBack(20) },
}));

// GET /api/scenarios (camelCase; el hook mapea a snake_case)
const SCENARIOS = [
  { id: "sc1", name: "Cliente indeciso", objection: "No estoy seguro si lo necesito", clientPersona: "Empresario cauteloso de 45 años", difficulty: "facil" },
  { id: "sc2", name: "Objeción de precio", objection: "Está muy caro para mí", clientPersona: "Dueña de PyME orientada a costos", difficulty: "medio" },
  { id: "sc3", name: "Comparando competencia", objection: "La competencia me da mejor precio", clientPersona: "Gerente analítico", difficulty: "medio" },
  { id: "sc4", name: "Sin tiempo", objection: "Ahora no tengo tiempo", clientPersona: "Ejecutivo ocupado", difficulty: "dificil" },
  { id: "sc5", name: "Cierre difícil", objection: "Déjame pensarlo", clientPersona: "Cliente evasivo", difficulty: "dificil" },
].map((s, i) => ({
  ...s,
  description: `Practica el escenario: ${s.name.toLowerCase()}.`,
  firstMessage: "Hola, buenas tardes...",
  voiceType: i % 2 === 0 ? "male" : "female",
  isActive: true,
  displayOrder: i,
  createdAt: dateBack(180 - i),
}));

const SCENARIO_PROGRESS = SCENARIOS.map((s, i) => ({
  scenarioId: s.id,
  isUnlocked: i <= 3,
  isCompleted: i <= 2,
  bestScore: i <= 2 ? 78 + i * 6 : null,
  attempts: i <= 2 ? 2 + i : i === 3 ? 1 : 0,
}));

// Citas (GET /api/citas) — Coach Center
const CITAS = Array.from({ length: 6 }).map((_, i) => {
  const [fn, ln] = NAMES[i];
  const sede = SEDES[i % SEDES.length];
  return {
    id: `cita-${i}`,
    director: ["Sr. Pérez", "Sra. Ruiz", "Ing. Castro"][i % 3],
    asesorId: `stu-${i}`,
    asesorName: `${fn} ${ln}`,
    cliente: ["Acme Corp", "Distribuidora Sol", "Grupo Andes", "TecnoMax", "Café Central", "Óptica Visión"][i],
    municipio: sede.city,
    ciudad: sede.city,
    zona: `Zona ${1 + (i % 15)}`,
    fecha: dateBack(-(i + 1)),
    horaInicio: `0${8 + (i % 8)}:00`,
    tipo: i % 2 === 0 ? "virtual" : "presencial",
    prioridad: ["alta", "media", "baja"][i % 3],
    linkSala: i % 2 === 0 ? "https://meet.senoriales.com/sala" : null,
    notas: "Seguimiento de propuesta comercial Q3.",
    createdBy: "coach-1",
    createdAt: dateBack(2),
    updatedAt: dateBack(1),
    asesor: { id: `stu-${i}`, email: `${fn.toLowerCase()}@senoriales.com`, firstName: fn, lastName: ln },
    creator: { id: "coach-1", email: "margarita@senoriales.com", firstName: "Coach", lastName: "Margarita" },
  };
});

// ---- respuestas por endpoint ----
export function getDemoResponse(method: string, rawPath: string): unknown {
  const path = rawPath.split("?")[0];

  if (method !== "GET") {
    // Las mutaciones en demo son no-ops.
    return { success: true, ok: true, status: "ok" };
  }

  switch (path) {
    case "/auth/me":
      return { user: DEMO_USER, roles: DEMO_ROLES };

    // ---- Estudiante ----
    case "/api/sessions":
      return SESSIONS;
    case "/api/scenarios":
      return SCENARIOS;
    case "/api/progress":
      return SCENARIO_PROGRESS;
    case "/api/analytics/dashboard":
      return {
        scoreHistory: SESSIONS.slice(0, 8).map((s) => ({
          date: s.createdAt,
          score: s.score,
          scenarioName: SCENARIOS[Number(s.scenarioId.slice(2)) - 1]?.name ?? "Escenario",
          breakdown: BREAKDOWN,
        })),
        averageBreakdown: BREAKDOWN,
        latestBreakdown: { apertura: 92, escuchaActiva: 86, manejoObjeciones: 80, propuestaValor: 84, cierre: 78 },
        activityHeatmap: Array.from({ length: 56 }).map((_, i) => ({ date: dayBack(i), count: (i * 5) % 4 })),
      };
    case "/api/analytics/competencies":
      return SESSIONS.slice(0, 8).map((s, i) => ({
        date: s.createdAt,
        score: s.score,
        apertura: 80 + ((i * 5) % 18),
        escuchaActiva: 76 + ((i * 7) % 20),
        manejoObjeciones: 70 + ((i * 6) % 22),
        propuestaValor: 78 + ((i * 4) % 16),
        cierre: 68 + ((i * 8) % 24),
      }));

    case "/api/config":
      return {
        id: "cfg-1",
        callDurationProspeccionSec: 300,
        callDurationObjecionesSec: 600,
        passThresholdProspeccion: 75,
        passThresholdObjeciones: 80,
        certificateInstructorName: "Lic. Margarita Pérez",
        certificateDirectorName: "Dra. Marta Solís",
        certificateCourseName: "Maestría en Ventas Consultivas",
        certificateLevel1InstructorName: "Lic. Margarita Pérez",
        certificateLevel1DirectorName: "Dra. Marta Solís",
        certificateLevel1CourseName: "Prospección Profesional",
        updatedAt: dateBack(5),
      };

    // ---- Prospección ----
    case "/api/prospecting-scenarios/me":
      return {
        visible: ["warm_lead_followup", "cold_call_pyme", "objection_timing"],
        overrides: [
          { secretName: "warm_lead_followup", label: "Seguimiento a lead tibio", description: "Retoma el contacto y agenda una demo.", videoUrl: "", location: "Oficina", targetAge: "35-45" },
          { secretName: "cold_call_pyme", label: "Llamada en frío a PyME", description: "Abre conversación con una pequeña empresa.", videoUrl: "", location: "Comercio", targetAge: "40-55" },
        ],
      };

    // ---- Admin ----
    case "/api/admin/students":
      return STUDENTS;
    case "/api/admin/divisions":
      return DIVISIONS;
    case "/api/admin/coaches":
      return COACHES;
    case "/api/admin/sedes":
      return SEDES.map((s) => ({ ...s, address: "6a Avenida 14-45", isActive: true, createdAt: dateBack(300), updatedAt: dateBack(10) }));
    case "/api/admin/users/pending":
      return NAMES.slice(8, 11).map(([fn, ln], i) => ({
        id: `pend-${i}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@nuevo.com`,
        firstName: fn,
        lastName: ln,
        phoneNumber: `+502 41${(20 + i).toString()} 88${(10 + i).toString()}`,
        createdAt: dateBack(i),
        sedeId: SEDES[i % SEDES.length].id,
        sedeName: SEDES[i % SEDES.length].name,
        coachId: "coach-1",
        coachName: "Coach Margarita",
      }));
    case "/api/admin/analytics/usage":
      return {
        totals: { totalTimeSeconds: 486000, totalSessions: 342, activeStudents: 11, totalStudents: 12 },
        bySede: SEDES.map((s, i) => ({
          sedeId: s.id,
          sedeName: s.name,
          totalTimeSeconds: 180000 - i * 40000,
          totalSessions: 140 - i * 30,
          activeStudents: 5 - i,
          totalStudents: 6 - i,
        })),
        activityTrend: Array.from({ length: 30 }).map((_, i) => ({ date: dayBack(29 - i), count: 4 + ((i * 3) % 12) })),
      };
    case "/api/admin/analytics/time-by-mode":
      return {
        totals: { roleplayClienteSeconds: 210000, roleplayAsesorSeconds: 96000, objecionesSeconds: 132000, coachSeconds: 48000 },
        byStudent: STUDENTS.slice(0, 8).map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          roleplayClienteSeconds: 12000 + (Number(s.id.slice(4)) * 900),
          roleplayAsesorSeconds: 6000,
          objecionesSeconds: 8000,
          coachSeconds: 2400,
        })),
        byMode: [
          { key: "cliente", label: "Role-Play Cliente", students: 12, sessions: 160, seconds: 210000 },
          { key: "objeciones", label: "Objeciones", students: 9, sessions: 96, seconds: 132000 },
          { key: "asesor", label: "Role-Play Asesor", students: 8, sessions: 62, seconds: 96000 },
          { key: "coach", label: "Coach", students: 6, sessions: 24, seconds: 48000 },
        ],
        summary: { students: 12, sessions: 342, seconds: 486000 },
      };
    case "/api/admin/analytics":
      return { scoreHistory: [], averageBreakdown: BREAKDOWN };
    case "/api/admin/prospecting-scenarios":
      return SCENARIOS.map((s) => ({
        id: s.id,
        secretName: s.id === "sc1" ? "warm_lead_followup" : `scenario_${s.id}`,
        label: s.name,
        description: s.description,
        videoUrl: "",
        location: "Oficina",
        targetAge: "35-50",
        systemPrompt: "Eres un prospecto de ventas...",
        firstMessage: s.firstMessage,
        isActiveGlobal: true,
        builderParams: {},
      }));
    case "/api/admin/agent-configs":
      return [];

    // ---- Coach Center ----
    case "/api/citas":
      return CITAS;
    case "/api/citas/users":
      return STUDENTS.slice(0, 8).map((s) => ({ id: s.id, email: s.email, firstName: s.firstName, lastName: s.lastName }));
    case "/api/citas/directors":
      return ["Sr. Pérez", "Sra. Ruiz", "Ing. Castro"];

    default:
      // Por defecto, lista vacía (la mayoría de endpoints no cubiertos son listas).
      return [];
  }
}
