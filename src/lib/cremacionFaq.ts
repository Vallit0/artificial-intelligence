// ============================================================================
// Dudas frecuentes sobre cremación — BORRADOR para validación
// ----------------------------------------------------------------------------
// Guion de apoyo para el asesor: qué suele preguntar o temer el cliente y cómo
// responderlo con respeto. Los puntos legales deben contrastarse con el
// documento de normativa GT/MX antes del rollout; los religiosos con el
// equipo de capacitación. Cuando lleguen los resultados del focus group se
// ajustan prioridades y redacción.
// ============================================================================

export type FaqCategoryId =
  | "religion"
  | "legal"
  | "costo"
  | "proceso"
  | "cenizas"
  | "familia"
  | "salud";

export interface FaqCategory {
  id: FaqCategoryId;
  nombre: string;
  descripcion: string;
}

export interface FaqItem {
  id: string;
  categoria: FaqCategoryId;
  pregunta: string;
  // Lo que puede decir el asesor, en primera persona y en tono humano.
  respuesta: string;
  // Cómo abordarlo: tono, qué evitar, a qué producto conectar.
  tip?: string;
  // true = requiere validación legal / doctrinal antes de usarse con clientes.
  validar?: boolean;
  etiquetas: string[];
  frecuente?: boolean;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "religion",
    nombre: "Religión y creencias",
    descripcion: "¿Mi fe lo permite? ¿Qué dice la Iglesia? ¿Y la resurrección?",
  },
  {
    id: "legal",
    nombre: "Legal y normativa",
    descripcion: "Requisitos, permisos, tiempos mínimos y quién autoriza.",
  },
  {
    id: "costo",
    nombre: "Costo y formas de pago",
    descripcion: "Comparación con el entierro, mensualidades y qué incluye.",
  },
  {
    id: "proceso",
    nombre: "Proceso y tiempos",
    descripcion: "Qué pasa paso a paso, cuánto tarda y cómo se garantiza la identidad.",
  },
  {
    id: "cenizas",
    nombre: "Cenizas y destino final",
    descripcion: "Dónde conservarlas, si se pueden esparcir, repartir o trasladar.",
  },
  {
    id: "familia",
    nombre: "Familia, duelo y tradición",
    descripcion: "“No es nuestra costumbre”, desacuerdos familiares, dónde visitar.",
  },
  {
    id: "salud",
    nombre: "Salud y ambiente",
    descripcion: "Contaminación, marcapasos, enfermedades, higiene.",
  },
];

export const cremacionFaq: FaqItem[] = [
  // ------------------------------------------------------------- religión
  {
    id: "catolica-permite",
    categoria: "religion",
    pregunta: "Soy católico. ¿La Iglesia permite la cremación?",
    respuesta:
      "Sí. La Iglesia católica permite la cremación desde 1963 y lo reafirmó en 2016. Lo que pide es que las cenizas se conserven en un lugar sagrado, como un columbario o nicho en cementerio, y que no se esparzan ni se repartan entre la familia.",
    tip:
      "Conectar con nicho o columbario, no con urnas para compartir ni esparcimiento. Ofrecer misa o responso antes de la cremación.",
    validar: true,
    etiquetas: ["católico", "iglesia", "columbario", "lugar sagrado"],
    frecuente: true,
  },
  {
    id: "resurreccion",
    categoria: "religion",
    pregunta: "Si me creman, ¿cómo voy a resucitar?",
    respuesta:
      "Es una pregunta muy válida y muy humana. La enseñanza católica es clara en que la cremación no impide la resurrección: Dios no depende del estado del cuerpo. Lo que importa es el respeto con el que se tratan los restos, y eso está garantizado.",
    tip: "No debatir teología. Validar la emoción, dar la respuesta breve y, si insiste, sugerir consultarlo con su sacerdote o pastor.",
    validar: true,
    etiquetas: ["resurrección", "fe", "cuerpo"],
    frecuente: true,
  },
  {
    id: "evangelico",
    categoria: "religion",
    pregunta: "Soy evangélico / cristiano. ¿Mi iglesia lo acepta?",
    respuesta:
      "En la mayoría de iglesias evangélicas no hay una prohibición doctrinal: se considera una decisión personal y familiar. Algunas congregaciones son más tradicionales, así que vale la pena que lo converse con su pastor; nosotros nos adaptamos a lo que su iglesia recomiende.",
    tip: "Preguntar primero a qué iglesia asiste; nunca generalizar. Ofrecer culto de despedida previo a la cremación.",
    validar: true,
    etiquetas: ["evangélico", "cristiano", "pastor"],
    frecuente: true,
  },
  {
    id: "otras-religiones",
    categoria: "religion",
    pregunta: "¿Hay religiones que no permiten la cremación?",
    respuesta:
      "Sí. El judaísmo ortodoxo y el islam tradicionalmente no la practican, y algunas comunidades mayas prefieren el entierro por su vínculo con la tierra. Si ese es su caso, con gusto le mostramos los planes tradicionales; lo importante es que la despedida respete su fe.",
    tip: "No intentar convencer. Cambiar a producto tradicional sin perder la relación.",
    validar: true,
    etiquetas: ["judaísmo", "islam", "maya", "entierro"],
  },
  {
    id: "misa-cuerpo-presente",
    categoria: "religion",
    pregunta: "¿Puedo tener misa con el cuerpo presente antes de cremar?",
    respuesta:
      "Sí. De hecho es lo que la Iglesia recomienda: la misa o el servicio religioso se celebra con el cuerpo presente y después se realiza la cremación. Nuestros planes con velación lo incluyen.",
    tip: "Puente natural al Plan Familiar Plus o a la velación previa como complemento.",
    etiquetas: ["misa", "velación", "cuerpo presente"],
  },

  // ---------------------------------------------------------------- legal
  {
    id: "requisitos",
    categoria: "legal",
    pregunta: "¿Qué papeles se necesitan para cremar?",
    respuesta:
      "Básicamente tres cosas: el certificado médico de defunción, la inscripción de la defunción en el registro civil (RENAP en Guatemala, Registro Civil en México) y la autorización firmada por el familiar responsable. Nosotros gestionamos todo; la familia solo firma.",
    tip: "Subrayar que la empresa hace el trámite. Si hubo muerte violenta o sospechosa, se requiere autorización del Ministerio Público / Fiscalía.",
    validar: true,
    etiquetas: ["papeles", "certificado", "RENAP", "registro civil"],
    frecuente: true,
  },
  {
    id: "quien-autoriza",
    categoria: "legal",
    pregunta: "¿Quién decide si se crema: la persona o la familia?",
    respuesta:
      "Si la persona dejó por escrito su voluntad, como en un plan de previsión, esa voluntad se respeta. Si no, decide el familiar más cercano según la ley. Por eso el plan en vida es tan valioso: evita que la familia tenga que decidir en el peor momento.",
    tip: "Argumento fuerte para pre-necesidad: 'usted decide hoy, para que ellos no tengan que hacerlo'.",
    validar: true,
    etiquetas: ["voluntad", "familiar", "pre-necesidad"],
  },
  {
    id: "tiempo-minimo",
    categoria: "legal",
    pregunta: "¿Cuánto tiempo debe pasar antes de poder cremar?",
    respuesta:
      "Depende del país y de las circunstancias. En términos generales se requiere que la defunción esté registrada y, en algunos casos, que pasen al menos 24 a 48 horas. Nosotros le indicamos los tiempos exactos de su localidad.",
    tip: "No dar cifras como absolutas hasta validar con el documento de normativa GT/MX.",
    validar: true,
    etiquetas: ["horas", "plazo", "tiempos"],
  },
  {
    id: "esparcir-legal",
    categoria: "legal",
    pregunta: "¿Es legal esparcir las cenizas en el mar o en el campo?",
    respuesta:
      "En general sí, siempre que se cuente con el certificado de cremación y se respeten las normas del lugar: en áreas protegidas, playas concurridas o propiedad privada hace falta permiso. Le orientamos sobre las opciones permitidas en su zona.",
    tip: "Si la familia es católica practicante, recordar la recomendación de lugar sagrado.",
    validar: true,
    etiquetas: ["esparcir", "mar", "permiso"],
  },

  // ---------------------------------------------------------------- costo
  {
    id: "mas-barato",
    categoria: "costo",
    pregunta: "¿La cremación es más barata que el entierro?",
    respuesta:
      "Normalmente sí, porque no se compra un terreno a perpetuidad ni un ataúd definitivo. Lo que no debe faltar es la despedida: por eso tenemos planes que combinan velación y cremación a un costo menor que un sepelio completo.",
    tip: "Evitar vender 'lo barato'. Enfocar en 'inteligente y sin cargas'. Mostrar comparativo con la lista de precios.",
    etiquetas: ["precio", "barato", "comparar"],
    frecuente: true,
  },
  {
    id: "que-incluye",
    categoria: "costo",
    pregunta: "¿Qué incluye exactamente el precio?",
    respuesta:
      "Incluye el traslado, todos los trámites, la cremación en horno certificado, la urna y la entrega de cenizas. Si quiere velación, nicho o una urna especial, se lo muestro como complemento para que no haya sorpresas.",
    tip: "Usar el buscador de productos y leer la lista de 'Qué incluye' con el cliente.",
    etiquetas: ["incluye", "transparencia", "complementos"],
  },
  {
    id: "mensualidad",
    categoria: "costo",
    pregunta: "¿Puedo pagarlo a plazos? ¿Y si dejo de pagar?",
    respuesta:
      "Sí, el plan de previsión se paga en mensualidades y el precio queda congelado desde el primer pago. Si en algún momento tiene dificultad, hablamos con usted para reprogramar antes de perder lo pagado.",
    tip: "Confirmar la política vigente de mora antes de prometer condiciones.",
    validar: true,
    etiquetas: ["mensualidad", "plazos", "mora", "congelado"],
  },

  // -------------------------------------------------------------- proceso
  {
    id: "como-es-proceso",
    categoria: "proceso",
    pregunta: "¿Cómo es el proceso, paso a paso?",
    respuesta:
      "Primero recogemos a su ser querido y nos encargamos de los trámites. Si la familia lo desea, se realiza la velación o el servicio religioso. Luego se hace la cremación de forma individual y respetuosa, y en 24 a 48 horas entregamos las cenizas en la urna que eligieron.",
    tip: "Hablar despacio, con pausas. Es el momento de mayor ansiedad del cliente.",
    etiquetas: ["pasos", "proceso", "entrega"],
    frecuente: true,
  },
  {
    id: "identidad",
    categoria: "proceso",
    pregunta: "¿Cómo sé que las cenizas que me entregan son de mi familiar?",
    respuesta:
      "Es la pregunta más importante y la respondemos con hechos: cada cremación es individual, con una placa de identificación que acompaña al cuerpo desde el ingreso hasta la urna, y se entrega un certificado de cremación. Puede estar tranquilo.",
    tip: "No ofenderse ni minimizar. Describir el control de identidad con detalle y seguridad.",
    etiquetas: ["identidad", "confianza", "placa", "certificado"],
    frecuente: true,
  },
  {
    id: "ataud",
    categoria: "proceso",
    pregunta: "¿Se crema con el ataúd? ¿Tengo que comprar uno?",
    respuesta:
      "No tiene que comprar un ataúd definitivo. Para la velación se usa un ataúd de alquiler, y para la cremación un contenedor sencillo. Así la familia no paga algo que no se va a conservar.",
    tip: "Elimina una objeción fuerte de costo. Conectar con velación previa.",
    etiquetas: ["ataúd", "alquiler", "contenedor"],
  },
  {
    id: "puede-presenciar",
    categoria: "proceso",
    pregunta: "¿La familia puede estar presente en la cremación?",
    respuesta:
      "Sí, si así lo desean. Algunas familias quieren acompañar hasta el último momento; otras prefieren esperar. Les ofrecemos un espacio tranquilo y respetamos lo que decidan.",
    tip: "Confirmar disponibilidad de la sala de despedida en cada sede antes de ofrecerlo.",
    validar: true,
    etiquetas: ["presenciar", "acompañar", "despedida"],
  },

  // -------------------------------------------------------------- cenizas
  {
    id: "donde-guardar",
    categoria: "cenizas",
    pregunta: "¿Dónde puedo guardar las cenizas?",
    respuesta:
      "Tiene varias opciones: un nicho en columbario del cementerio, donde la familia tiene un lugar para visitar; conservarlas en casa en una urna; o un jardín de cenizas con placa conmemorativa. Lo conversamos según lo que más consuele a su familia.",
    tip: "Preguntar '¿quién querrá visitar a su ser querido?'. Si hay varios, orientar a columbario.",
    etiquetas: ["columbario", "casa", "jardín", "nicho"],
    frecuente: true,
  },
  {
    id: "repartir",
    categoria: "cenizas",
    pregunta: "¿Podemos repartir las cenizas entre los hijos?",
    respuesta:
      "Es posible, con mini urnas o joyas conmemorativas, y muchas familias lo hacen. Si su familia es católica practicante, la Iglesia recomienda conservar las cenizas juntas en un lugar sagrado; se lo menciono para que decidan con toda la información.",
    tip: "Honestidad: no ocultar la recomendación católica si el cliente es practicante.",
    etiquetas: ["repartir", "mini urna", "joya", "hijos"],
  },
  {
    id: "viajar-cenizas",
    categoria: "cenizas",
    pregunta: "¿Puedo llevar las cenizas a otro país o a mi pueblo?",
    respuesta:
      "Sí. Para traslados dentro del país entregamos la documentación necesaria, y para el extranjero gestionamos la apostilla y los permisos consulares. Repatriar cenizas es mucho más sencillo y económico que repatriar un cuerpo.",
    tip: "Argumento clave para familias con parientes en EE. UU. o en el interior.",
    etiquetas: ["traslado", "repatriación", "extranjero", "pueblo"],
  },

  // -------------------------------------------------------------- familia
  {
    id: "no-es-costumbre",
    categoria: "familia",
    pregunta: "“Eso no es nuestra costumbre; aquí siempre se ha enterrado.”",
    respuesta:
      "Lo entiendo perfectamente, y esa tradición merece respeto. Cada vez más familias combinan ambas cosas: la velación y el servicio religioso como siempre se han hecho, y la cremación como una forma de que los hijos no carguen con gastos ni mantenimiento. Pero la decisión es completamente suya.",
    tip: "No contraargumentar la tradición. Mostrar que la despedida se conserva igual.",
    etiquetas: ["costumbre", "tradición", "entierro"],
    frecuente: true,
  },
  {
    id: "desacuerdo-familiar",
    categoria: "familia",
    pregunta: "Yo sí quisiera, pero mis hijos no están de acuerdo.",
    respuesta:
      "Es muy común. Por eso le sugiero dejarlo por escrito en su plan y conversarlo con calma con ellos ahora, no en el momento difícil. Si quiere, podemos tener una reunión con la familia para responder sus dudas con tranquilidad.",
    tip: "Ofrecer la reunión familiar. El plan en vida convierte la decisión en voluntad expresa.",
    etiquetas: ["hijos", "desacuerdo", "familia", "voluntad"],
  },
  {
    id: "lugar-visitar",
    categoria: "familia",
    pregunta: "¿Y a dónde vamos a ir a visitarlo?",
    respuesta:
      "Esa necesidad es muy real y la tenemos cubierta: el nicho en columbario le da un lugar digno, con su placa, dentro del cementerio, igual que una tumba pero sin el costo ni el mantenimiento de un terreno.",
    tip: "Puente directo al columbario (5 años o perpetuo).",
    etiquetas: ["visitar", "columbario", "placa"],
    frecuente: true,
  },
  {
    id: "arrepentirse",
    categoria: "familia",
    pregunta: "¿Y si después nos arrepentimos?",
    respuesta:
      "Es importante decirlo con claridad: la cremación no se puede revertir. Por eso nunca apuramos la decisión. Si tienen dudas, lo conversamos, lo consultan con quien necesiten, y avanzamos solo cuando la familia esté en paz con la decisión.",
    tip: "Honestidad total. Transmite confianza y baja la presión.",
    etiquetas: ["arrepentir", "irreversible", "decisión"],
  },

  // ---------------------------------------------------------------- salud
  {
    id: "contamina",
    categoria: "salud",
    pregunta: "¿La cremación contamina el ambiente?",
    respuesta:
      "Nuestros hornos están certificados y cuentan con filtros que controlan las emisiones. Comparada con un entierro, la cremación no ocupa suelo ni usa materiales que tardan décadas en degradarse, y hay opciones como la urna biodegradable que incluso siembran un árbol.",
    tip: "Para clientes jóvenes o ambientalistas, conectar con la urna biodegradable.",
    etiquetas: ["ambiente", "contaminación", "ecológico", "árbol"],
  },
  {
    id: "marcapasos",
    categoria: "salud",
    pregunta: "Mi papá tiene marcapasos, ¿se puede cremar?",
    respuesta:
      "Sí. Solo es necesario retirar el marcapasos y otros dispositivos con batería antes de la cremación, por seguridad. Nosotros lo coordinamos con el personal médico; la familia no tiene que ocuparse de eso.",
    tip: "Preguntar siempre por marcapasos o prótesis con batería al recolectar datos.",
    etiquetas: ["marcapasos", "dispositivo", "seguridad"],
  },
  {
    id: "enfermedad",
    categoria: "salud",
    pregunta: "Falleció de una enfermedad contagiosa, ¿cambia algo?",
    respuesta:
      "La cremación es, de hecho, el procedimiento más recomendado desde el punto de vista sanitario en esos casos. Seguimos los protocolos de salud correspondientes y la familia puede despedirse de forma segura.",
    tip: "Tono tranquilizador; no entrar en detalles clínicos.",
    validar: true,
    etiquetas: ["contagio", "sanitario", "protocolo"],
  },
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const searchFaq = (query: string, categoria: FaqCategoryId | "todas"): FaqItem[] => {
  const q = normalize(query.trim());
  const terms = q ? q.split(/\s+/) : [];
  return cremacionFaq.filter((item) => {
    if (categoria !== "todas" && item.categoria !== categoria) return false;
    if (terms.length === 0) return true;
    const haystack = normalize(
      [item.pregunta, item.respuesta, item.tip ?? "", ...item.etiquetas].join(" "),
    );
    return terms.every((t) => haystack.includes(t));
  });
};
