import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Sparkles,
  Check,
  ClipboardList,
  HelpCircle,
  Tag,
  MapPin,
  MessageSquareQuote,
  ShieldCheck,
  Users,
  X,
  ArrowLeft,
  Package,
} from "lucide-react";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useLevelMode, moduleLabel } from "@/hooks/useLevelMode";
import CremacionCampaignBanner from "@/components/cremacion/CremacionCampaignBanner";
import { CREMACION_ACCENT_BG, CREMACION_BADGE_CLASS, CremacionIcon } from "@/lib/cremacion-theme";
import {
  PRODUCT_CATEGORIES,
  COUNTRY_LABEL,
  cremacionCatalog,
  formatPrice,
  searchCatalog,
  type CatalogFilters,
  type Country,
  type CremacionProduct,
  type ProductCategory,
} from "@/lib/cremacionCatalog";

// Sugerencias rápidas: lo que un asesor buscaría en medio de una llamada.
const QUICK_SEARCHES = ["religión", "precio", "despedida", "árbol", "pareja", "repatriar", "compartir"];

const CATEGORY_ICON: Record<ProductCategory, React.ElementType> = {
  "Plan de cremación": ClipboardList,
  Urnas: Package,
  "Nichos y columbarios": MapPin,
  "Servicios complementarios": ShieldCheck,
  Recordatorios: Sparkles,
};

const ProductosCremacion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLevel, isCremacion, setTrack } = useLevelMode();

  // País por defecto: el de la sede del usuario, si lo tiene.
  const userCountry = (user?.sede as { country?: string } | undefined)?.country?.toUpperCase();
  const defaultCountry: Country | "Todos" =
    userCountry === "GT" || userCountry === "MX" ? (userCountry as Country) : "Todos";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogFilters["category"]>("Todas");
  const [country, setCountry] = useState<CatalogFilters["country"]>(defaultCountry);
  const [selected, setSelected] = useState<CremacionProduct | null>(null);

  const results = useMemo(
    () => searchCatalog({ query, category, country }),
    [query, category, country],
  );

  // Moneda para mostrar en las tarjetas: la del filtro de país, o GT por defecto.
  const priceCountry: Country = country === "Todos" ? "GT" : country;

  const hasFilters = query.trim() !== "" || category !== "Todas" || country !== "Todos";

  const clearFilters = () => {
    setQuery("");
    setCategory("Todas");
    setCountry("Todos");
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen flex flex-col animate-fade-in">
        <div className="flex-1 px-4 sm:px-8 py-8 pb-28 lg:pb-12 max-w-6xl w-full mx-auto">
          {/* Top bar */}
          <div className="flex items-start justify-between gap-4 mb-6">
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
                  Datos de ejemplo · pendiente focus group
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Buscador de productos
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Encuentra el producto de cremación correcto durante la llamada: busca por nombre,
                por necesidad del cliente o por la objeción que acabas de escuchar.
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

          {/* Aviso si el usuario entró sin tener la pista Cremación activa */}
          {!isCremacion && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm">
              <span className="text-foreground/80">
                Estás viendo el catálogo de Cremación, pero tu práctica sigue en modo tradicional.
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
          <div className="rounded-3xl border-2 border-orange-500/30 bg-card shadow-soft p-4 sm:p-5 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ej. "urna para compartir", "mi religión no permite", "sin nicho"…'
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

            {/* Quick searches */}
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

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-2 flex-1">
                <FilterChip active={category === "Todas"} onClick={() => setCategory("Todas")}>
                  Todas
                </FilterChip>
                {PRODUCT_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                      <Icon className="w-3.5 h-3.5" />
                      {c}
                    </FilterChip>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-muted p-1 self-start">
                {(["Todos", "GT", "MX"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCountry(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      country === c ? "text-white shadow" : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={country === c ? { background: CREMACION_ACCENT_BG } : undefined}
                  >
                    {c === "Todos" ? "GT + MX" : c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{results.length}</span> de {cremacionCatalog.length}{" "}
              productos
              {" · "}
              <button
                onClick={() => navigate("/cremacion/dudas")}
                className="inline-flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-300 hover:underline"
              >
                <HelpCircle className="w-3.5 h-3.5" /> ver dudas frecuentes
              </button>
              {country !== "Todos" && (
                <>
                  {" "}
                  · precios en <span className="font-semibold">{COUNTRY_LABEL[country]}</span>
                </>
              )}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-orange-600 dark:text-orange-300 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Results grid */}
          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center">
              <Search className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-bold text-foreground">Sin resultados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Prueba con otra palabra: una necesidad ("despedida"), un objeto ("urna") o una objeción ("caro").
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  priceCountry={priceCountry}
                  index={i}
                  onClick={() => setSelected(p)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNavigation />

      <ProductDetailDialog
        product={selected}
        priceCountry={priceCountry}
        onClose={() => setSelected(null)}
      />

      <style>{`
        @keyframes productPop {
          0% { opacity: 0; transform: translateY(8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
      active
        ? "text-white border-transparent shadow"
        : "bg-card text-foreground/80 border-border hover:border-orange-500/40"
    }`}
    style={active ? { background: CREMACION_ACCENT_BG } : undefined}
  >
    {children}
  </button>
);

const ProductCard = ({
  product,
  priceCountry,
  index,
  onClick,
}: {
  product: CremacionProduct;
  priceCountry: Country;
  index: number;
  onClick: () => void;
}) => {
  const Icon = CATEGORY_ICON[product.categoria];
  const price = product.precio[priceCountry];
  const availableHere = product.paises.includes(priceCountry);
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border-2 border-orange-500/25 bg-gradient-to-br from-orange-500/10 to-amber-400/5 p-4 shadow-md transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl hover:border-orange-500/60 active:scale-[0.98]"
      style={{ animation: `productPop 0.35s ease-out ${Math.min(index, 12) * 0.04}s both` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-300">
          <Icon className="w-3 h-3" />
          {product.categoria}
        </span>
        {product.destacado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-300">
            <Sparkles className="w-3 h-3" /> Destacado
          </span>
        )}
      </div>
      <p className="font-bold text-sm text-foreground leading-snug">{product.nombre}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">{product.resumen}</p>
      <div className="flex items-end justify-between gap-2 mt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {availableHere ? `Precio ${priceCountry}` : "No disponible en " + priceCountry}
          </p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300">
            {availableHere ? formatPrice(price, priceCountry) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {product.paises.map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {product.etiquetas.slice(0, 3).map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Tag className="w-2.5 h-2.5" />
            {t}
          </span>
        ))}
      </div>
    </button>
  );
};

const ProductDetailDialog = ({
  product,
  priceCountry,
  onClose,
}: {
  product: CremacionProduct | null;
  priceCountry: Country;
  onClose: () => void;
}) => {
  if (!product) return null;
  const Icon = CATEGORY_ICON[product.categoria];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-orange-500/30">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-300">
              <Icon className="w-3 h-3" />
              {product.categoria}
            </span>
            {product.paises.map((c) => (
              <span key={c} className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                {COUNTRY_LABEL[c]}
              </span>
            ))}
          </div>
          <DialogTitle className="text-xl leading-tight">{product.nombre}</DialogTitle>
          <DialogDescription>{product.resumen}</DialogDescription>
        </DialogHeader>

        {/* Precios */}
        <div className="grid grid-cols-2 gap-3">
          {(["GT", "MX"] as Country[]).map((c) => {
            const available = product.paises.includes(c);
            return (
              <div
                key={c}
                className={`rounded-2xl border p-3 ${
                  c === priceCountry ? "border-orange-500/50 bg-orange-500/5" : "border-border"
                } ${available ? "" : "opacity-50"}`}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {COUNTRY_LABEL[c]}
                </p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-300">
                  {available ? formatPrice(product.precio[c], c) : "No disponible"}
                </p>
              </div>
            );
          })}
        </div>

        <Section icon={ShieldCheck} title="Qué incluye">
          <ul className="grid sm:grid-cols-2 gap-1.5">
            {product.incluye.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/85">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Users} title="Perfil del cliente">
          <p className="text-sm text-foreground/85">{product.perfilCliente}</p>
        </Section>

        <Section icon={MessageSquareQuote} title="Lo que dijo el focus group" accent>
          <p className="text-sm italic text-foreground/85">“{product.insightFocusGroup}”</p>
        </Section>

        <Section icon={Sparkles} title="Argumentos de venta">
          <ul className="space-y-1.5">
            {product.argumentosVenta.map((a) => (
              <li key={a} className="flex items-start gap-2 text-sm text-foreground/85">
                <Check className="w-3.5 h-3.5 mt-0.5 text-orange-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </Section>

        {product.objecionesFrecuentes.length > 0 && (
          <Section icon={MessageSquareQuote} title="Objeciones frecuentes y cómo responder">
            <div className="space-y-2">
              {product.objecionesFrecuentes.map((o) => (
                <div key={o.objecion} className="rounded-2xl border border-border p-3">
                  <p className="text-sm font-bold text-foreground">“{o.objecion}”</p>
                  <p className="text-sm text-foreground/80 mt-1">{o.respuesta}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Section = ({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) => (
  <div className={`rounded-2xl p-3 ${accent ? "bg-orange-500/5 border border-orange-500/20" : ""}`}>
    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
      <Icon className="w-3.5 h-3.5 text-orange-500" />
      {title}
    </p>
    {children}
  </div>
);

export default ProductosCremacion;
