// ============================================================================
// Catálogo de productos para el buscador del módulo Cremación
// ----------------------------------------------------------------------------
// Fuente real: fichas .docx en docs/productos-mexico (5 ciudades de México +
// Perla Océano Guatemala), convertidas por scripts/parse-productos-docx.py a
// src/data/productos.generated.ts. Los productos de Guatemala de la línea
// Cremación todavía no se han entregado: mientras tanto se muestran EJEMPLOS
// marcados con `esEjemplo` para validar la UX.
// ============================================================================

import { productosGenerados } from "@/data/productos.generated";

export type Pais = "GT" | "MX";

export type TipoProducto = "Servicio" | "Propiedad" | "Propiedad y servicio";

export type CategoriaProducto =
  | "Cremación"
  | "Funerario con cremación"
  | "Servicio funerario"
  | "Nichos y columbarios"
  | "Perla memorial y arrecife"
  | "Urnas y recordatorios"
  | "Servicios complementarios";

export interface SeccionProducto {
  titulo: string;
  items: string[];
}

export interface Producto {
  id: string;
  codigo: string | null;
  nombre: string;
  nombreOriginal: string;
  pais: Pais;
  sede: string;
  sedeEnDocumento?: string;
  tipo: TipoProducto;
  categoria: CategoriaProducto;
  incluyeCremacion: boolean;
  incluyeVelacion: boolean;
  incluyeInhumacion: boolean;
  incluyePropiedad: boolean;
  incluyeHomenaje: boolean;
  secciones: SeccionProducto[];
  fuente: string;
  // --- Campos opcionales (hoy sólo en los ejemplos de GT) ---
  esEjemplo?: boolean;
  precio?: number | null;
  perfilCliente?: string;
  insightFocusGroup?: string;
  argumentosVenta?: string[];
  objecionesFrecuentes?: { objecion: string; respuesta: string }[];
  etiquetas?: string[];
}

export const PAIS_LABEL: Record<Pais, string> = {
  GT: "Guatemala",
  MX: "México",
};

export const MONEDA: Record<Pais, string> = { GT: "Q", MX: "$" };

export const CATEGORIAS: CategoriaProducto[] = [
  "Cremación",
  "Funerario con cremación",
  "Nichos y columbarios",
  "Perla memorial y arrecife",
  "Urnas y recordatorios",
  "Servicios complementarios",
  "Servicio funerario",
];

export const SECCIONES_ORDEN = [
  "Tipo de producto",
  "Servicio de velación",
  "Alimentos y bebidas",
  "Servicio de traslado",
  "Servicio de inhumación",
  "Servicio de cremación",
  "Trámites y gestiones legales",
  "Homenaje",
  "Propiedad",
  "Beneficios especiales",
];

export const formatPrecio = (value: number | null | undefined, pais: Pais): string => {
  if (value === null || value === undefined) return "A cotizar";
  return `${MONEDA[pais]}${value.toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
};

// ---------------------------------------------------------------------------
// Ejemplos de Guatemala (línea Cremación) — PLACEHOLDER hasta recibir fichas.
// ---------------------------------------------------------------------------
interface EjemploGT {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  tipo: TipoProducto;
  precio: number | null;
  resumen: string;
  incluye: string[];
  perfilCliente: string;
  insightFocusGroup: string;
  argumentosVenta: string[];
  objecionesFrecuentes?: { objecion: string; respuesta: string }[];
  etiquetas: string[];
  cremacion?: boolean;
  velacion?: boolean;
  propiedad?: boolean;
  homenaje?: boolean;
}

const ejemploGT = (e: EjemploGT): Producto => ({
  id: `gt-ejemplo-${e.id}`,
  codigo: null,
  nombre: e.nombre,
  nombreOriginal: e.nombre.toUpperCase(),
  pais: "GT",
  sede: "Guatemala",
  tipo: e.tipo,
  categoria: e.categoria,
  incluyeCremacion: !!e.cremacion,
  incluyeVelacion: !!e.velacion,
  incluyeInhumacion: false,
  incluyePropiedad: !!e.propiedad,
  incluyeHomenaje: !!e.homenaje,
  secciones: [
    { titulo: "Tipo de producto", items: [e.tipo] },
    { titulo: "Descripción", items: [e.resumen] },
    { titulo: "Qué incluye", items: e.incluye },
  ],
  fuente: "Ejemplo (pendiente ficha oficial GT)",
  esEjemplo: true,
  precio: e.precio,
  perfilCliente: e.perfilCliente,
  insightFocusGroup: e.insightFocusGroup,
  argumentosVenta: e.argumentosVenta,
  objecionesFrecuentes: e.objecionesFrecuentes ?? [],
  etiquetas: e.etiquetas,
});

export const productosEjemploGT: Producto[] = [
  ejemploGT({
    id: "plan-cremacion-esencial",
    nombre: "Plan Cremación Esencial (pre-necesidad)",
    categoria: "Cremación",
    tipo: "Servicio",
    precio: 18500,
    resumen:
      "Plan de previsión que cubre el servicio de cremación completo: recolección, trámites, cremación y urna básica.",
    incluye: [
      "Traslado dentro del área metropolitana",
      "Trámites legales y certificado de cremación",
      "Cremación en horno certificado",
      "Urna básica de madera",
      "Entrega de cenizas a la familia",
    ],
    perfilCliente: "Adultos 35–55 años que buscan simplicidad y evitar gastos imprevistos a la familia.",
    insightFocusGroup:
      "Los participantes asociaron la cremación con 'no dejar cargas'; valoran un precio fijo y pagos mensuales bajos.",
    argumentosVenta: [
      "Precio congelado hoy: la cremación sube de precio cada año.",
      "Un solo pago mensual accesible, sin sorpresas para la familia.",
    ],
    objecionesFrecuentes: [
      {
        objecion: "Todavía estoy joven, no lo necesito.",
        respuesta: "Justamente por eso conviene: congela el precio de hoy y lo paga sin apuro, en cuotas pequeñas.",
      },
    ],
    etiquetas: ["pre-necesidad", "mensualidad"],
    cremacion: true,
  }),
  ejemploGT({
    id: "plan-cremacion-familiar",
    nombre: "Plan Cremación Familiar Plus",
    categoria: "Funerario con cremación",
    tipo: "Propiedad y servicio",
    precio: 32900,
    resumen: "Velación, capilla y cremación, con nicho en columbario por 5 años.",
    incluye: [
      "Velación de 12 horas en capilla",
      "Arreglo floral y libro de condolencias",
      "Traslado y trámites",
      "Cremación y urna de madera premium",
      "Nicho en columbario por 5 años",
    ],
    perfilCliente: "Familias con tradición de velación que quieren una ceremonia completa antes de cremar.",
    insightFocusGroup: "El miedo a 'no poder despedirse' hizo de la velación previa el diferenciador más valorado.",
    argumentosVenta: ["La despedida tradicional y la practicidad de la cremación, con un lugar para visitar."],
    etiquetas: ["velación", "columbario"],
    cremacion: true,
    velacion: true,
    propiedad: true,
  }),
  ejemploGT({
    id: "cremacion-inmediata",
    nombre: "Cremación de necesidad inmediata",
    categoria: "Cremación",
    tipo: "Servicio",
    precio: 24500,
    resumen: "Servicio completo de cremación para familias que enfrentan el fallecimiento hoy, con atención 24/7.",
    incluye: ["Atención y recolección 24/7", "Trámites legales exprés", "Cremación en 24–48 horas", "Urna básica"],
    perfilCliente: "Familiares en duelo que necesitan resolver rápido y con acompañamiento.",
    insightFocusGroup: "En necesidad inmediata pesan la claridad del proceso y los tiempos; la empatía define la decisión.",
    argumentosVenta: ["Nosotros nos encargamos del papeleo; la familia sólo acompaña.", "Cenizas en 48 horas máximo."],
    etiquetas: ["necesidad inmediata", "24/7"],
    cremacion: true,
  }),
  ejemploGT({
    id: "urna-madera-clasica",
    nombre: "Urna de madera clásica",
    categoria: "Urnas y recordatorios",
    tipo: "Propiedad",
    precio: 1250,
    resumen: "Urna de cedro barnizado con placa grabable, capacidad estándar para adulto.",
    incluye: ["Placa de identificación grabada", "Bolsa interior sellada"],
    perfilCliente: "Familias que quieren una urna sobria para conservar en casa o columbario.",
    insightFocusGroup: "La madera se percibe como 'cálida' y 'digna'; el grabado del nombre genera apego.",
    argumentosVenta: ["Grabado incluido con el nombre y fechas."],
    etiquetas: ["madera", "grabado"],
    propiedad: true,
  }),
  ejemploGT({
    id: "urna-biodegradable",
    nombre: "Urna biodegradable (agua / tierra)",
    categoria: "Urnas y recordatorios",
    tipo: "Propiedad",
    precio: 980,
    resumen: "Urna ecológica de fibra natural para esparcir o sembrar las cenizas.",
    incluye: ["Semilla de árbol nativo (versión tierra)", "Guía de ceremonia"],
    perfilCliente: "Personas jóvenes o con conciencia ambiental que desean 'volver a la naturaleza'.",
    insightFocusGroup: "'Convertirse en árbol' fue lo más comentado por participantes menores de 40 años.",
    argumentosVenta: ["Un homenaje que da vida: las cenizas nutren un árbol."],
    objecionesFrecuentes: [
      {
        objecion: "¿Es legal esparcir cenizas?",
        respuesta: "Sí, con el certificado de cremación; le orientamos sobre los lugares permitidos.",
      },
    ],
    etiquetas: ["ecológica", "árbol"],
    propiedad: true,
  }),
  ejemploGT({
    id: "nicho-columbario-5",
    nombre: "Nicho en columbario (5 años)",
    categoria: "Nichos y columbarios",
    tipo: "Propiedad",
    precio: 6500,
    resumen: "Espacio individual en columbario de cementerio Señoriales, con placa y derecho de visita.",
    incluye: ["Placa de mármol grabada", "Mantenimiento de áreas comunes", "Renovable"],
    perfilCliente: "Familias que quieren un lugar para visitar sin comprar un terreno.",
    insightFocusGroup: "Tener 'un lugar a donde ir' sigue siendo esencial, incluso para quienes eligen cremación.",
    argumentosVenta: ["Un lugar digno para visitar, a una fracción del costo de un lote."],
    etiquetas: ["columbario", "visita"],
    propiedad: true,
  }),
  ejemploGT({
    id: "nicho-columbario-perpetuo",
    nombre: "Nicho en columbario perpetuo (doble)",
    categoria: "Nichos y columbarios",
    tipo: "Propiedad",
    precio: 14900,
    resumen: "Nicho a perpetuidad para hasta 2 urnas, con placa doble.",
    incluye: ["Capacidad 2 urnas", "Placa doble grabada", "Sin renovaciones"],
    perfilCliente: "Parejas que planifican juntas.",
    insightFocusGroup: "Las parejas valoran 'descansar juntos'; el nicho doble resolvió esa inquietud.",
    argumentosVenta: ["Un solo pago, para siempre, para los dos."],
    etiquetas: ["perpetuo", "pareja"],
    propiedad: true,
  }),
  ejemploGT({
    id: "velacion-previa",
    nombre: "Velación previa a cremación (12 h)",
    categoria: "Servicios complementarios",
    tipo: "Servicio",
    precio: 6800,
    resumen: "Velación en capilla con ataúd de alquiler antes de la cremación.",
    incluye: ["Capilla 12 horas", "Ataúd de alquiler", "Café y servicio"],
    perfilCliente: "Familias que compraron un plan básico y quieren añadir la despedida.",
    insightFocusGroup: "El ataúd de alquiler eliminó la objeción de 'pagar un ataúd que se va a quemar'.",
    argumentosVenta: ["La despedida completa sin pagar un ataúd que no se usará."],
    etiquetas: ["velación", "add-on"],
    velacion: true,
  }),
  ejemploGT({
    id: "repatriacion-cenizas",
    nombre: "Repatriación internacional de cenizas",
    categoria: "Servicios complementarios",
    tipo: "Servicio",
    precio: null,
    resumen: "Gestión consular y envío internacional de cenizas (EE. UU., Centroamérica).",
    incluye: ["Apostilla y permisos", "Envío courier especializado"],
    perfilCliente: "Familias con parientes en el extranjero.",
    insightFocusGroup: "La cremación se percibe como la única vía viable para repatriar a bajo costo.",
    argumentosVenta: ["Repatriar cenizas cuesta una fracción de repatriar un cuerpo."],
    etiquetas: ["internacional", "cotizar"],
  }),
  ejemploGT({
    id: "joya-conmemorativa",
    nombre: "Joya conmemorativa con cenizas",
    categoria: "Urnas y recordatorios",
    tipo: "Propiedad",
    precio: 850,
    resumen: "Dije de acero quirúrgico con cápsula para una porción de cenizas.",
    incluye: ["Cadena", "Kit de llenado"],
    perfilCliente: "Hijos y nietos que quieren llevar un recuerdo cerca.",
    insightFocusGroup: "Mencionado espontáneamente como 'lo que yo quisiera'.",
    argumentosVenta: ["Llevar siempre consigo a quien amó."],
    etiquetas: ["joya", "regalo"],
    propiedad: true,
  }),
];

// Catálogo completo: fichas reales + ejemplos GT.
export const catalogoProductos: Producto[] = [...productosGenerados, ...productosEjemploGT];

export const sedesPorPais = (pais: Pais): string[] =>
  Array.from(new Set(catalogoProductos.filter((p) => p.pais === pais).map((p) => p.sede))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

export const categoriasPorPais = (pais: Pais): CategoriaProducto[] =>
  CATEGORIAS.filter((c) => catalogoProductos.some((p) => p.pais === pais && p.categoria === c));

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export interface FiltrosProductos {
  query: string;
  pais: Pais;
  sede: string | "Todas";
  categoria: CategoriaProducto | "Todas";
  soloCremacion: boolean;
}

export const buscarProductos = (f: FiltrosProductos): Producto[] => {
  const q = normalize(f.query.trim());
  const terms = q ? q.split(/\s+/) : [];
  return catalogoProductos.filter((p) => {
    if (p.pais !== f.pais) return false;
    if (f.sede !== "Todas" && p.sede !== f.sede) return false;
    if (f.categoria !== "Todas" && p.categoria !== f.categoria) return false;
    if (f.soloCremacion && !p.incluyeCremacion && p.categoria !== "Urnas y recordatorios" && p.categoria !== "Nichos y columbarios" && p.categoria !== "Perla memorial y arrecife") return false;
    if (terms.length === 0) return true;
    const haystack = normalize(
      [
        p.nombre,
        p.codigo ?? "",
        p.sede,
        p.categoria,
        p.tipo,
        ...(p.etiquetas ?? []),
        ...(p.argumentosVenta ?? []),
        p.perfilCliente ?? "",
        ...(p.objecionesFrecuentes ?? []).flatMap((o) => [o.objecion, o.respuesta]),
        ...p.secciones.flatMap((s) => [s.titulo, ...s.items]),
      ].join(" "),
    );
    return terms.every((t) => haystack.includes(t));
  });
};

// Resumen de una línea para la tarjeta: lo más relevante de la ficha.
export const resumenProducto = (p: Producto): string => {
  const pick = (titulo: string) =>
    p.secciones.find((s) => s.titulo === titulo)?.items.find((i) => !/^no\s+(incluye|aplica)/i.test(i));
  return (
    pick("Descripción") ??
    (p.incluyeCremacion ? pick("Servicio de cremación") : undefined) ??
    pick("Propiedad") ??
    pick("Homenaje") ??
    pick("Servicio de velación") ??
    pick("Servicio de traslado") ??
    ""
  );
};
