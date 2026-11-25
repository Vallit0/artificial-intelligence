// ============================================================================
// Catálogo de productos de Cremación — DATOS DE EJEMPLO (mockup)
// ----------------------------------------------------------------------------
// Estos registros son placeholders para validar la UX del buscador. Cuando
// lleguen los resultados del focus group y la lista de precios oficial, se
// reemplazan aquí (o se mueven a una tabla en Postgres + endpoint /api/productos).
// ============================================================================

export type Country = "GT" | "MX";

export type ProductCategory =
  | "Plan de cremación"
  | "Urnas"
  | "Nichos y columbarios"
  | "Servicios complementarios"
  | "Recordatorios";

export interface CremacionProduct {
  id: string;
  nombre: string;
  categoria: ProductCategory;
  paises: Country[];
  // Precio de lista por país (moneda local). null = cotizar.
  precio: Partial<Record<Country, number | null>>;
  resumen: string;
  incluye: string[];
  perfilCliente: string;
  // Lo que el focus group dijo sobre este producto / necesidad (placeholder).
  insightFocusGroup: string;
  argumentosVenta: string[];
  objecionesFrecuentes: { objecion: string; respuesta: string }[];
  etiquetas: string[];
  destacado?: boolean;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Plan de cremación",
  "Urnas",
  "Nichos y columbarios",
  "Servicios complementarios",
  "Recordatorios",
];

export const COUNTRY_LABEL: Record<Country, string> = {
  GT: "Guatemala",
  MX: "México",
};

export const CURRENCY: Record<Country, { code: string; symbol: string }> = {
  GT: { code: "GTQ", symbol: "Q" },
  MX: { code: "MXN", symbol: "$" },
};

export const formatPrice = (value: number | null | undefined, country: Country): string => {
  if (value === null || value === undefined) return "A cotizar";
  const { symbol } = CURRENCY[country];
  return `${symbol}${value.toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
};

export const cremacionCatalog: CremacionProduct[] = [
  {
    id: "plan-cremacion-esencial",
    nombre: "Plan Cremación Esencial (pre-necesidad)",
    categoria: "Plan de cremación",
    paises: ["GT", "MX"],
    precio: { GT: 18500, MX: 42000 },
    resumen:
      "Plan de previsión que cubre el servicio de cremación completo: recolección, trámites, cremación y urna básica.",
    incluye: [
      "Traslado del cuerpo dentro del área metropolitana",
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
      "La familia decide dónde descansan las cenizas: en casa, columbario o jardín.",
    ],
    objecionesFrecuentes: [
      {
        objecion: "Todavía estoy joven, no lo necesito.",
        respuesta:
          "Justamente por eso conviene: congela el precio a la tarifa de hoy y lo paga sin apuro, en cuotas pequeñas.",
      },
      {
        objecion: "Mi religión no permite la cremación.",
        respuesta:
          "Respetamos cada creencia. Podemos revisar el plan tradicional, o explicar cómo la mayoría de iglesias hoy aceptan la cremación con depósito en un lugar sagrado.",
      },
    ],
    etiquetas: ["pre-necesidad", "mensualidad", "básico"],
    destacado: true,
  },
  {
    id: "plan-cremacion-familiar",
    nombre: "Plan Cremación Familiar Plus",
    categoria: "Plan de cremación",
    paises: ["GT", "MX"],
    precio: { GT: 32900, MX: 69000 },
    resumen:
      "Plan de previsión con velación, capilla y cremación. Pensado para familias que quieren despedirse antes de la cremación.",
    incluye: [
      "Velación de 12 horas en capilla",
      "Arreglo floral y libro de condolencias",
      "Traslado y trámites",
      "Cremación y urna de madera premium",
      "Nicho en columbario por 5 años",
    ],
    perfilCliente: "Familias con tradición de velación que quieren una ceremonia completa antes de cremar.",
    insightFocusGroup:
      "El grupo expresó miedo a 'no poder despedirse'; la velación previa a la cremación fue el diferenciador más valorado.",
    argumentosVenta: [
      "Combina lo mejor de ambos mundos: la despedida tradicional y la practicidad de la cremación.",
      "Incluye un lugar para visitar a su ser querido (columbario) sin el costo de un terreno.",
    ],
    objecionesFrecuentes: [
      {
        objecion: "Es más caro que el plan básico.",
        respuesta:
          "La diferencia es la velación y el columbario; comparado con un entierro tradicional, sigue siendo cerca de la mitad del costo.",
      },
    ],
    etiquetas: ["pre-necesidad", "velación", "columbario"],
    destacado: true,
  },
  {
    id: "cremacion-inmediata",
    nombre: "Cremación de necesidad inmediata",
    categoria: "Plan de cremación",
    paises: ["GT", "MX"],
    precio: { GT: 24500, MX: 55000 },
    resumen:
      "Servicio completo de cremación para familias que enfrentan el fallecimiento hoy, con atención 24/7.",
    incluye: [
      "Atención y recolección 24/7",
      "Trámites legales exprés",
      "Cremación en 24–48 horas",
      "Urna básica",
    ],
    perfilCliente: "Familiares en duelo que necesitan resolver rápido y con acompañamiento.",
    insightFocusGroup:
      "En necesidad inmediata lo que más pesa es la claridad del proceso y los tiempos; la empatía del asesor define la decisión.",
    argumentosVenta: [
      "Nosotros nos encargamos de todo el papeleo; la familia sólo acompaña.",
      "Tiempos claros: cenizas entregadas en 48 horas máximo.",
    ],
    objecionesFrecuentes: [
      {
        objecion: "Necesito consultarlo con el resto de la familia.",
        respuesta:
          "Por supuesto. Mientras tanto podemos iniciar la recolección y los trámites sin compromiso de servicio final.",
      },
    ],
    etiquetas: ["necesidad inmediata", "24/7"],
  },
  {
    id: "urna-madera-clasica",
    nombre: "Urna de madera clásica",
    categoria: "Urnas",
    paises: ["GT", "MX"],
    precio: { GT: 1250, MX: 2900 },
    resumen: "Urna de cedro barnizado con placa grabable. Capacidad estándar para adulto.",
    incluye: ["Placa de identificación grabada", "Bolsa interior sellada"],
    perfilCliente: "Familias que quieren una urna sobria para conservar en casa o columbario.",
    insightFocusGroup: "La madera se percibe como 'cálida' y 'digna'; el grabado del nombre genera apego emocional.",
    argumentosVenta: ["Grabado incluido con el nombre y fechas.", "Cabe en cualquier nicho estándar."],
    objecionesFrecuentes: [
      {
        objecion: "¿No viene incluida en el plan?",
        respuesta: "El plan incluye una urna básica; ésta es la opción premium de madera noble.",
      },
    ],
    etiquetas: ["madera", "grabado"],
  },
  {
    id: "urna-biodegradable",
    nombre: "Urna biodegradable (agua / tierra)",
    categoria: "Urnas",
    paises: ["GT", "MX"],
    precio: { GT: 980, MX: 2300 },
    resumen: "Urna ecológica de fibra natural para esparcir o sembrar las cenizas. Se disuelve en agua o tierra.",
    incluye: ["Semilla de árbol nativo (versión tierra)", "Guía de ceremonia"],
    perfilCliente: "Personas jóvenes o con conciencia ambiental que desean 'volver a la naturaleza'.",
    insightFocusGroup:
      "El concepto de 'convertirse en árbol' fue el más comentado por participantes menores de 40 años.",
    argumentosVenta: ["Un homenaje que da vida: las cenizas nutren un árbol.", "Opción sin costo de nicho."],
    objecionesFrecuentes: [
      {
        objecion: "¿Es legal esparcir cenizas?",
        respuesta: "Sí, con el certificado de cremación; le orientamos sobre los lugares permitidos en su país.",
      },
    ],
    etiquetas: ["ecológica", "árbol", "sin nicho"],
    destacado: true,
  },
  {
    id: "urna-metalica-premium",
    nombre: "Urna metálica premium",
    categoria: "Urnas",
    paises: ["GT"],
    precio: { GT: 2800 },
    resumen: "Urna de latón con acabado en bronce envejecido, cierre hermético.",
    incluye: ["Cierre hermético", "Estuche de terciopelo"],
    perfilCliente: "Familias que buscan una urna duradera para columbario.",
    insightFocusGroup: "Se percibe como la opción 'para toda la vida'; el peso y el acabado transmiten permanencia.",
    argumentosVenta: ["Hermética y resistente a humedad: ideal para columbario."],
    objecionesFrecuentes: [],
    etiquetas: ["metal", "columbario"],
  },
  {
    id: "nicho-columbario-5",
    nombre: "Nicho en columbario (5 años)",
    categoria: "Nichos y columbarios",
    paises: ["GT", "MX"],
    precio: { GT: 6500, MX: 15000 },
    resumen: "Espacio individual en columbario de cementerio Señoriales, con placa y derecho de visita.",
    incluye: ["Placa de mármol grabada", "Mantenimiento de áreas comunes", "Renovable"],
    perfilCliente: "Familias que quieren un lugar para visitar sin comprar un terreno.",
    insightFocusGroup:
      "Tener 'un lugar a donde ir' sigue siendo esencial para la mayoría, incluso quienes eligen cremación.",
    argumentosVenta: [
      "Un lugar digno para visitar, a una fracción del costo de un lote.",
      "Renovable o convertible a perpetuo.",
    ],
    objecionesFrecuentes: [
      {
        objecion: "¿Y después de los 5 años?",
        respuesta: "Se renueva o se cambia a nicho perpetuo con descuento por antigüedad.",
      },
    ],
    etiquetas: ["columbario", "visita"],
  },
  {
    id: "nicho-columbario-perpetuo",
    nombre: "Nicho en columbario perpetuo",
    categoria: "Nichos y columbarios",
    paises: ["GT", "MX"],
    precio: { GT: 14900, MX: 34000 },
    resumen: "Nicho a perpetuidad para hasta 2 urnas, con placa doble.",
    incluye: ["Capacidad 2 urnas", "Placa doble grabada", "Sin renovaciones"],
    perfilCliente: "Parejas que planifican juntas.",
    insightFocusGroup: "Las parejas valoran 'descansar juntos'; el nicho doble resolvió esa inquietud en el grupo.",
    argumentosVenta: ["Un solo pago, para siempre, para los dos."],
    objecionesFrecuentes: [],
    etiquetas: ["perpetuo", "pareja"],
  },
  {
    id: "jardin-cenizas",
    nombre: "Jardín de cenizas (esparcimiento)",
    categoria: "Nichos y columbarios",
    paises: ["GT"],
    precio: { GT: 2200 },
    resumen:
      "Ceremonia de esparcimiento de cenizas en jardín memorial del cementerio, con placa conmemorativa en muro.",
    incluye: ["Ceremonia guiada", "Placa en muro de memoria"],
    perfilCliente: "Familias que no quieren conservar la urna pero sí un lugar de recuerdo.",
    insightFocusGroup: "Alternativa 'intermedia' bien recibida: libera a la familia pero deja huella.",
    argumentosVenta: ["Sin urna que cuidar, pero con un nombre que visitar."],
    objecionesFrecuentes: [],
    etiquetas: ["esparcimiento", "jardín"],
  },
  {
    id: "velacion-previa",
    nombre: "Velación previa a cremación (12 h)",
    categoria: "Servicios complementarios",
    paises: ["GT", "MX"],
    precio: { GT: 6800, MX: 16000 },
    resumen: "Servicio de velación en capilla con ataúd de alquiler antes de la cremación.",
    incluye: ["Capilla 12 horas", "Ataúd de alquiler", "Café y servicio"],
    perfilCliente: "Familias que compraron un plan básico y quieren añadir la despedida.",
    insightFocusGroup: "El ataúd de alquiler eliminó la objeción de 'pagar un ataúd que se va a quemar'.",
    argumentosVenta: ["La despedida completa sin pagar un ataúd que no se usará."],
    objecionesFrecuentes: [
      {
        objecion: "¿Para qué velar si lo van a cremar?",
        respuesta: "La velación es para la familia: el duelo necesita un momento de despedida.",
      },
    ],
    etiquetas: ["velación", "add-on"],
  },
  {
    id: "traslado-nacional",
    nombre: "Traslado nacional de cenizas",
    categoria: "Servicios complementarios",
    paises: ["GT", "MX"],
    precio: { GT: 1500, MX: 3800 },
    resumen: "Traslado certificado de la urna a cualquier departamento / estado del país.",
    incluye: ["Documentación de traslado", "Entrega en mano"],
    perfilCliente: "Familias con raíces en el interior del país.",
    insightFocusGroup: "Muy valorado por migrantes internos: 'quiero que descanse en su pueblo'.",
    argumentosVenta: ["Las cenizas viajan con papeles y seguro, sin trámites para la familia."],
    objecionesFrecuentes: [],
    etiquetas: ["traslado", "interior"],
  },
  {
    id: "repatriacion-cenizas",
    nombre: "Repatriación internacional de cenizas",
    categoria: "Servicios complementarios",
    paises: ["GT", "MX"],
    precio: { GT: null, MX: null },
    resumen: "Gestión consular y envío internacional de cenizas (EE. UU., Centroamérica).",
    incluye: ["Apostilla y permisos", "Envío courier especializado"],
    perfilCliente: "Familias con parientes en el extranjero.",
    insightFocusGroup: "La cremación se percibe como la única vía viable para repatriar a bajo costo.",
    argumentosVenta: ["Repatriar cenizas cuesta una fracción de repatriar un cuerpo."],
    objecionesFrecuentes: [],
    etiquetas: ["internacional", "cotizar"],
  },
  {
    id: "joya-conmemorativa",
    nombre: "Joya conmemorativa con cenizas",
    categoria: "Recordatorios",
    paises: ["GT", "MX"],
    precio: { GT: 850, MX: 1900 },
    resumen: "Dije de acero quirúrgico con cápsula para una porción de cenizas.",
    incluye: ["Cadena", "Kit de llenado"],
    perfilCliente: "Hijos y nietos que quieren llevar un recuerdo cerca.",
    insightFocusGroup: "Las mujeres del grupo lo mencionaron espontáneamente como 'lo que yo quisiera'.",
    argumentosVenta: ["Llevar siempre consigo a quien amó."],
    objecionesFrecuentes: [],
    etiquetas: ["joya", "regalo"],
  },
  {
    id: "mini-urna",
    nombre: "Mini urna para compartir cenizas",
    categoria: "Recordatorios",
    paises: ["GT", "MX"],
    precio: { GT: 420, MX: 950 },
    resumen: "Mini urna de cerámica para repartir las cenizas entre varios familiares.",
    incluye: ["Caja de regalo"],
    perfilCliente: "Familias numerosas o que viven en distintas ciudades.",
    insightFocusGroup: "Resolvió la tensión de '¿quién se queda con las cenizas?' que surgió en varios grupos.",
    argumentosVenta: ["Cada hijo puede tener a su mamá o papá cerca."],
    objecionesFrecuentes: [],
    etiquetas: ["compartir", "familia"],
  },
];

// Búsqueda simple por texto: nombre, resumen, categoría, etiquetas,
// argumentos y objeciones (para que el asesor pueda buscar por la objeción
// que acaba de escuchar, ej. "religión").
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export interface CatalogFilters {
  query: string;
  category: ProductCategory | "Todas";
  country: Country | "Todos";
}

export const searchCatalog = (filters: CatalogFilters): CremacionProduct[] => {
  const q = normalize(filters.query.trim());
  const terms = q ? q.split(/\s+/) : [];
  return cremacionCatalog.filter((p) => {
    if (filters.category !== "Todas" && p.categoria !== filters.category) return false;
    if (filters.country !== "Todos" && !p.paises.includes(filters.country)) return false;
    if (terms.length === 0) return true;
    const haystack = normalize(
      [
        p.nombre,
        p.resumen,
        p.categoria,
        p.perfilCliente,
        p.insightFocusGroup,
        ...p.etiquetas,
        ...p.incluye,
        ...p.argumentosVenta,
        ...p.objecionesFrecuentes.flatMap((o) => [o.objecion, o.respuesta]),
      ].join(" "),
    );
    return terms.every((t) => haystack.includes(t));
  });
};
