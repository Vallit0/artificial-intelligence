import { useState, useEffect } from "react";

// Tips por pagina del PDF. La key es el numero de pagina.
export const PAGE_TIPS: Record<number, string> = {
  1: "Esta es la portada del Legado de Vida. Entregalo siempre con ambas manos y con solemnidad.",
  2: "Aqui se presentan los datos generales. Verifica cada dato con la familia antes de continuar.",
  3: "Seccion de beneficiarios. Explica claramente quien esta cubierto y bajo que condiciones.",
  4: "Servicios incluidos. Conecta cada servicio con tranquilidad: 'Usted no tendra que preocuparse por...'",
  5: "Plan de pagos. Nunca digas 'costo', di 'inversion' o 'aportacion'. Compara con algo cotidiano.",
  6: "Condiciones generales. Se transparente: 'Quiero ser completamente honesto con ustedes...'",
  7: "Linea de emergencia 24/7. Pide al titular que guarde el numero en su telefono ahora mismo.",
  8: "Cierre y despedida. Di: 'Gracias por confiar en nosotros. Han tomado una decision llena de amor.'",
};

export const DEFAULT_TIP = "Revisa esta seccion con atencion. Si tienes dudas, consulta con tu supervisor.";

const TipBanner = ({ currentPage }: { currentPage: number }) => {
  const [animating, setAnimating] = useState(false);
  const tip = PAGE_TIPS[currentPage] || DEFAULT_TIP;

  useEffect(() => {
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  return (
    <div
      className={`
        max-w-2xl w-full mx-auto mb-4 px-5 py-3 rounded-2xl
        bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800
        transition-all duration-300
        ${animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">🐾</span>
        <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">{tip}</p>
      </div>
    </div>
  );
};

export default TipBanner;
