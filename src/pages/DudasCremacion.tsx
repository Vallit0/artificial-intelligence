import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  HelpCircle,
  Church,
  Scale,
  Wallet,
  ListChecks,
  Archive,
  Users,
  HeartPulse,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  Star,
  Package,
} from "lucide-react";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import UserMenu from "@/components/UserMenu";
import CremacionCampaignBanner from "@/components/cremacion/CremacionCampaignBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useLevelMode, moduleLabel } from "@/hooks/useLevelMode";
import { CREMACION_ACCENT_BG, CREMACION_BADGE_CLASS, CremacionIcon } from "@/lib/cremacion-theme";
import {
  FAQ_CATEGORIES,
  cremacionFaq,
  searchFaq,
  type FaqCategoryId,
  type FaqItem,
} from "@/lib/cremacionFaq";

const CATEGORY_ICON: Record<FaqCategoryId, React.ElementType> = {
  religion: Church,
  legal: Scale,
  costo: Wallet,
  proceso: ListChecks,
  cenizas: Archive,
  familia: Users,
  salud: HeartPulse,
};

const QUICK_SEARCHES = ["católico", "resurrección", "papeles", "barato", "visitar", "repartir", "marcapasos"];

const DudasCremacion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLevel, isCremacion, setTrack } = useLevelMode();

  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<FaqCategoryId | "todas">("todas");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => searchFaq(query, categoria), [query, categoria]);
  const hasFilters = query.trim() !== "" || categoria !== "todas";

  const countByCategory = useMemo(() => {
    const m = new Map<FaqCategoryId, number>();
    cremacionFaq.forEach((f) => m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1));
    return m;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen flex flex-col animate-fade-in">
        <div className="flex-1 px-4 sm:px-8 py-8 pb-28 lg:pb-12 max-w-5xl w-full mx-auto">
          {/* Top bar */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/practice")}
                className="font-bold uppercase tracking-wider text-xs -ml-3 mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a práctica
              </Button>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] border ${CREMACION_BADGE_CLASS}`}
                >
                  <CremacionIcon className="w-3 h-3" />
                  Módulo · {isCremacion ? moduleLabel(currentLevel, "cremacion") : "Cremación"}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                  Borrador · pendiente validación y focus group
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Dudas frecuentes sobre cremación
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Lo que la gente pregunta o teme, y cómo responderlo con respeto. Busca por la duda
                que acabas de escuchar y lee la respuesta sugerida.
              </p>
            </div>
            {user && (
              <span className="hidden sm:inline-block">
                <UserMenu />
              </span>
            )}
          </div>

          <div className="mb-5">
            <CremacionCampaignBanner level={currentLevel} compact />
          </div>

          {!isCremacion && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm">
              <span className="text-foreground/80">
                Estás viendo las dudas de Cremación, pero tu práctica sigue en modo tradicional.
              </span>
              <Button
                size="sm"
                className="rounded-xl text-white border-0"
                style={{ background: CREMACION_ACCENT_BG }}
                onClick={() => setTrack("cremacion")}
              >
                <CremacionIcon className="w-4 h-4 mr-1.5" />
                Activar Cremación
              </Button>
            </div>
          )}

          {/* Search */}
          <div className="rounded-3xl border-2 border-orange-500/30 bg-card shadow-soft p-4 sm:p-5 mb-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ej. "mi religión", "cómo sé que son sus cenizas", "no es nuestra costumbre"…'
                className="h-12 pl-12 pr-10 rounded-2xl text-base border-orange-500/20 focus-visible:ring-orange-500"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                Búsquedas rápidas
              </span>
              {QUICK_SEARCHES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    query === q
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-orange-500/5 text-orange-700 dark:text-orange-300 border-orange-500/20 hover:bg-orange-500/15"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Categorías */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <CategoryTile
              active={categoria === "todas"}
              icon={HelpCircle}
              label="Todas"
              count={cremacionFaq.length}
              onClick={() => setCategoria("todas")}
            />
            {FAQ_CATEGORIES.map((c) => (
              <CategoryTile
                key={c.id}
                active={categoria === c.id}
                icon={CATEGORY_ICON[c.id]}
                label={c.nombre}
                count={countByCategory.get(c.id) ?? 0}
                onClick={() => setCategoria(c.id)}
              />
            ))}
          </div>

          {categoria !== "todas" && (
            <p className="text-sm text-muted-foreground mb-3 -mt-2">
              {FAQ_CATEGORIES.find((c) => c.id === categoria)?.descripcion}
            </p>
          )}

          {/* Results header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{results.length}</span> de {cremacionFaq.length} dudas
            </p>
            {hasFilters && (
              <button
                onClick={() => {
                  setQuery("");
                  setCategoria("todas");
                }}
                className="text-xs font-semibold text-orange-600 dark:text-orange-300 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Lista */}
          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center">
              <Search className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-bold text-foreground">Sin resultados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Prueba con otra palabra, o escríbela tal como la dijo el cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((item, i) => (
                <FaqRow
                  key={item.id}
                  item={item}
                  index={i}
                  open={openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-bold text-foreground">¿Necesitas el producto concreto?</p>
                <p className="text-xs text-muted-foreground">Planes, urnas y nichos con precios GT/MX.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/productos")}>
              Abrir buscador de productos
            </Button>
          </div>
        </div>
      </main>

      <MobileNavigation />

      <style>{`
        @keyframes faqPop {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------

const CategoryTile = ({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  count: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-left transition-all ${
      active
        ? "border-transparent text-white shadow-md"
        : "border-orange-500/20 bg-card hover:border-orange-500/50"
    }`}
    style={active ? { background: CREMACION_ACCENT_BG } : undefined}
  >
    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-orange-500"}`} />
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold leading-tight truncate">{label}</span>
    </span>
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        active ? "bg-white/25 text-white" : "bg-orange-500/10 text-orange-700 dark:text-orange-300"
      }`}
    >
      {count}
    </span>
  </button>
);

const FaqRow = ({
  item,
  index,
  open,
  onToggle,
}: {
  item: FaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
}) => {
  const Icon = CATEGORY_ICON[item.categoria];
  const cat = FAQ_CATEGORIES.find((c) => c.id === item.categoria);
  return (
    <div
      className={`rounded-2xl border-2 bg-gradient-to-br from-orange-500/[0.07] to-amber-400/[0.03] transition-colors ${
        open ? "border-orange-500/60 shadow-md" : "border-orange-500/20 hover:border-orange-500/45"
      }`}
      style={{ animation: `faqPop 0.3s ease-out ${Math.min(index, 12) * 0.03}s both` }}
    >
      <button onClick={onToggle} className="w-full flex items-start gap-3 p-4 text-left" aria-expanded={open}>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-300">
          <Icon className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700/80 dark:text-orange-300/80">
              {cat?.nombre}
            </span>
            {item.frecuente && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                <Star className="w-3 h-3" /> Muy frecuente
              </span>
            )}
            {item.validar && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
                <AlertTriangle className="w-3 h-3" /> Validar
              </span>
            )}
          </span>
          <span className="block text-sm font-bold text-foreground leading-snug">{item.pregunta}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 mt-1 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pl-14 space-y-3 animate-fade-in">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Qué puedes decir
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">“{item.respuesta}”</p>
          </div>
          {item.tip && (
            <div className="flex items-start gap-2 rounded-xl bg-orange-500/5 border border-orange-500/20 p-3">
              <Lightbulb className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                <span className="font-bold">Cómo abordarlo: </span>
                {item.tip}
              </p>
            </div>
          )}
          {item.validar && (
            <p className="text-[11px] text-muted-foreground">
              Esta respuesta debe contrastarse con el documento de normativa GT/MX o con capacitación antes de usarse con clientes.
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {item.etiquetas.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DudasCremacion;
