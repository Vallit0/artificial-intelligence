import { useEffect, useMemo, useState } from "react";
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
  Building2,
  Waves,
  Layers,
  Flower2,
  Globe2,
  Lock,
  FileText,
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
  PAIS_LABEL,
  SECCIONES_ORDEN,
  buscarProductos,
  catalogoProductos,
  categoriasPorPais,
  formatPrecio,
  resumenProducto,
  sedesPorPais,
  type CategoriaProducto,
  type FiltrosProductos,
  type Pais,
  type Producto,
} from "@/lib/productos";

// Sugerencias rápidas: lo que un asesor buscaría en medio de una llamada.
const QUICK_SEARCHES = ["nicho doble", "urna", "velación", "perla", "sin cofre", "mantenimiento", "misa"];

const CATEGORY_ICON: Record<CategoriaProducto, React.ElementType> = {
  Cremación: ClipboardList,
  "Funerario con cremación": Layers,
  "Servicio funerario": FileText,
  "Nichos y columbarios": MapPin,
  "Perla memorial y arrecife": Waves,
  "Urnas y recordatorios": Package,
  "Servicios complementarios": ShieldCheck,
};

const toPais = (raw?: string | null): Pais | null => {
  const c = raw?.trim().toUpperCase();
  return c === "GT" || c === "MX" ? c : null;
};

const ProductosCremacion = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { currentLevel, isCremacion, setTrack } = useLevelMode();

  // País: el asesor ve sólo el de su sede; el admin puede alternar GT / MX.
  const userPais = toPais(user?.sede?.country);
  const canChoosePais = isAdmin || !userPais;
  const [pais, setPais] = useState<Pais>(userPais ?? "MX");
  useEffect(() => {
    if (userPais) setPais(userPais);
  }, [userPais]);

  const sedes = useMemo(() => sedesPorPais(pais), [pais]);
  const categorias = useMemo(() => categoriasPorPais(pais), [pais]);

  // Sede por defecto: la del usuario si coincide con alguna del catálogo.
  const defaultSede = useMemo(() => {
    const name = user?.sede?.name?.toLowerCase() ?? "";
    return sedes.find((s) => name && (name.includes(s.toLowerCase()) || s.toLowerCase().includes(name))) ?? "Todas";
  }, [sedes, user?.sede?.name]);

  const [query, setQuery] = useState("");
  const [sede, setSede] = useState<string>(defaultSede);
  const [categoria, setCategoria] = useState<FiltrosProductos["categoria"]>("Todas");
  const [soloCremacion, setSoloCremacion] = useState(true);
  const [selected, setSelected] = useState<Producto | null>(null);

  // Al cambiar de país, la sede y la categoría se reinician.
  useEffect(() => {
    setSede(defaultSede);
    setCategoria("Todas");
  }, [pais, defaultSede]);

  const results = useMemo(
    () => buscarProductos({ query, pais, sede, categoria, soloCremacion }),
    [query, pais, sede, categoria, soloCremacion],
  );
  const totalPais = useMemo(() => catalogoProductos.filter((p) => p.pais === pais).length, [pais]);
  const hasEjemplos = useMemo(() => catalogoProductos.some((p) => p.pais === pais && p.esEjemplo), [pais]);

  const hasFilters = query.trim() !== "" || sede !== "Todas" || categoria !== "Todas" || !soloCremacion;
  const clearFilters = () => {
    setQuery("");
    setSede("Todas");
    setCategoria("Todas");
    setSoloCremacion(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen flex flex-col animate-fade-in">
        <div className="flex-1 px-4 sm:px-8 py-8 pb-28 lg:pb-12 max-w-6xl w-full mx-auto">
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
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                  <FileText className="w-3 h-3" />
                  Fichas oficiales · Revisión 2026
                </span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground"
                style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
              >
                Buscador de productos
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Encuentra el producto correcto durante la llamada: busca por nombre, código, lo que
                incluye o lo que el cliente necesita.
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

          {/* País */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">País</span>
              {canChoosePais ? (
                <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                  {(["GT", "MX"] as Pais[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setPais(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        pais === c ? "text-white shadow" : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={pais === c ? { background: CREMACION_ACCENT_BG } : undefined}
                    >
                      {PAIS_LABEL[c]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: CREMACION_ACCENT_BG }}>
                  {PAIS_LABEL[pais]}
                  <Lock className="w-3 h-3 opacity-80" />
                </span>
              )}
              {isAdmin && (
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  Como admin ves ambos países; cada asesor sólo ve el suyo.
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{totalPais}</span> fichas en {PAIS_LABEL[pais]}
            </p>
          </div>

          {hasEjemplos && (
            <div className="mb-4 rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-2.5 text-xs text-foreground/80">
              <span className="font-bold">Guatemala:</span> la única ficha oficial recibida es Perla Océano. El
              resto son <span className="font-bold">ejemplos</span> para validar la UX hasta recibir las fichas de la línea Cremación GT.
            </div>
          )}

          {/* Search */}
          <div className="rounded-3xl border-2 border-orange-500/30 bg-card shadow-soft p-4 sm:p-5 mb-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ej. "nicho doble", "CRARESUR001", "urna grabada", "misa de cenizas"…'
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

            {/* Sede */}
            {sedes.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  <Building2 className="w-3.5 h-3.5" /> Sede
                </span>
                <FilterChip active={sede === "Todas"} onClick={() => setSede("Todas")}>
                  Todas
                </FilterChip>
                {sedes.map((s) => (
                  <FilterChip key={s} active={sede === s} onClick={() => setSede(s)}>
                    {s}
                  </FilterChip>
                ))}
              </div>
            )}

            {/* Categoría + solo cremación */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-2 flex-1">
                <FilterChip active={categoria === "Todas"} onClick={() => setCategoria("Todas")}>
                  Todas
                </FilterChip>
                {categorias.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <FilterChip key={c} active={categoria === c} onClick={() => setCategoria(c)}>
                      <Icon className="w-3.5 h-3.5" />
                      {c}
                    </FilterChip>
                  );
                })}
              </div>
              <button
                onClick={() => setSoloCremacion((v) => !v)}
                className={`inline-flex items-center gap-2 self-start rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  soloCremacion
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={soloCremacion}
                title="Oculta los servicios funerarios de inhumación sin cremación"
              >
                <span
                  className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                  style={{ background: soloCremacion ? CREMACION_ACCENT_BG : "hsl(var(--border))" }}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: soloCremacion ? "translateX(15px)" : "translateX(2px)" }}
                  />
                </span>
                Sólo línea Cremación
              </button>
            </div>
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{results.length}</span> productos
              {sede !== "Todas" && (
                <>
                  {" "}
                  en <span className="font-semibold">{sede}</span>
                </>
              )}
              {" · "}
              <button
                onClick={() => navigate("/cremacion/dudas")}
                className="inline-flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-300 hover:underline"
              >
                <HelpCircle className="w-3.5 h-3.5" /> ver dudas frecuentes
              </button>
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

          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center">
              <Search className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-bold text-foreground">Sin resultados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Prueba con otra palabra, quita el filtro de sede o desactiva "Sólo línea Cremación".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} showSede={sede === "Todas"} onClick={() => setSelected(p)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNavigation />

      <ProductDetailDialog product={selected} onClose={() => setSelected(null)} />

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
      active ? "text-white border-transparent shadow" : "bg-card text-foreground/80 border-border hover:border-orange-500/40"
    }`}
    style={active ? { background: CREMACION_ACCENT_BG } : undefined}
  >
    {children}
  </button>
);

const Flag = ({ on, label }: { on: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
      on ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-muted text-muted-foreground/60 line-through"
    }`}
  >
    {on && <Check className="w-2.5 h-2.5" />}
    {label}
  </span>
);

const ProductCard = ({
  product,
  index,
  showSede,
  onClick,
}: {
  product: Producto;
  index: number;
  showSede: boolean;
  onClick: () => void;
}) => {
  const Icon = CATEGORY_ICON[product.categoria];
  const resumen = resumenProducto(product);
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col text-left rounded-2xl border-2 p-4 shadow-md transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${
        product.esEjemplo
          ? "border-dashed border-amber-500/40 bg-gradient-to-br from-amber-400/10 to-amber-300/5 hover:border-amber-500/70"
          : "border-orange-500/25 bg-gradient-to-br from-orange-500/10 to-amber-400/5 hover:border-orange-500/60"
      }`}
      style={{ animation: `productPop 0.35s ease-out ${Math.min(index, 12) * 0.04}s both` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-300">
          <Icon className="w-3 h-3" />
          {product.categoria}
        </span>
        {product.esEjemplo ? (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300">Ejemplo</span>
        ) : product.codigo ? (
          <span className="font-mono text-[10px] text-muted-foreground">{product.codigo}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">código pendiente</span>
        )}
      </div>
      <p className="font-bold text-sm text-foreground leading-snug">{product.nombre}</p>
      {resumen && <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">{resumen}</p>}

      <div className="flex flex-wrap gap-1 mt-3">
        <Flag on={product.incluyeCremacion} label="Cremación" />
        <Flag on={product.incluyeVelacion} label="Velación" />
        <Flag on={product.incluyePropiedad} label="Nicho / propiedad" />
        {product.incluyeHomenaje && <Flag on label="Homenaje" />}
      </div>

      <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-border/60 w-full">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {showSede && (
            <>
              <Building2 className="w-3 h-3" />
              <span className="font-semibold">{product.sede}</span>
              <span>·</span>
            </>
          )}
          <span>{product.tipo}</span>
        </div>
        {product.esEjemplo && (
          <span className="text-sm font-bold text-orange-600 dark:text-orange-300">
            {formatPrecio(product.precio, product.pais)}
          </span>
        )}
      </div>
    </button>
  );
};

const ProductDetailDialog = ({ product, onClose }: { product: Producto | null; onClose: () => void }) => {
  if (!product) return null;
  const Icon = CATEGORY_ICON[product.categoria];
  const secciones = [...product.secciones].sort((a, b) => {
    const ia = SECCIONES_ORDEN.indexOf(a.titulo);
    const ib = SECCIONES_ORDEN.indexOf(b.titulo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const isNegative = (s: string) => /^no\s+(incluye|inlcuye|aplica)/i.test(s);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-orange-500/30">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-300">
              <Icon className="w-3 h-3" />
              {product.categoria}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
              <Building2 className="w-3 h-3" /> {product.sede}, {PAIS_LABEL[product.pais]}
            </span>
            {product.codigo && (
              <span className="font-mono px-1.5 py-0.5 rounded-md text-[10px] bg-muted text-muted-foreground">
                {product.codigo}
              </span>
            )}
            {product.esEjemplo && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                Ejemplo · sin ficha oficial
              </span>
            )}
          </div>
          <DialogTitle className="text-xl leading-tight">{product.nombre}</DialogTitle>
          <DialogDescription>
            {product.tipo}
            {product.esEjemplo && ` · ${formatPrecio(product.precio, product.pais)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1">
          <Flag on={product.incluyeCremacion} label="Cremación" />
          <Flag on={product.incluyeVelacion} label="Velación" />
          <Flag on={product.incluyeInhumacion} label="Inhumación" />
          <Flag on={product.incluyePropiedad} label="Nicho / propiedad" />
          <Flag on={product.incluyeHomenaje} label="Homenaje" />
        </div>

        {secciones.map((s) => {
          const allNegative = s.items.every(isNegative);
          return (
            <Section key={s.titulo} icon={allNegative ? X : Check} title={s.titulo} muted={allNegative}>
              <ul className="space-y-1.5">
                {s.items.map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-sm ${isNegative(item) ? "text-muted-foreground" : "text-foreground/85"}`}
                  >
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isNegative(item) ? "bg-muted-foreground/40" : "bg-orange-500"}`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}

        {product.perfilCliente && (
          <Section icon={Users} title="Perfil del cliente">
            <p className="text-sm text-foreground/85">{product.perfilCliente}</p>
          </Section>
        )}
        {product.insightFocusGroup && (
          <Section icon={MessageSquareQuote} title="Lo que dijo el focus group" accent>
            <p className="text-sm italic text-foreground/85">“{product.insightFocusGroup}”</p>
          </Section>
        )}
        {product.argumentosVenta && product.argumentosVenta.length > 0 && (
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
        )}
        {product.objecionesFrecuentes && product.objecionesFrecuentes.length > 0 && (
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
        {product.etiquetas && product.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.etiquetas.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Tag className="w-2.5 h-2.5" />
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Flower2 className="w-3 h-3" /> Fuente: {product.fuente}
        </p>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({
  icon: Icon,
  title,
  accent,
  muted,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) => (
  <div className={`rounded-2xl p-3 ${accent ? "bg-orange-500/5 border border-orange-500/20" : ""} ${muted ? "opacity-70" : ""}`}>
    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
      <Icon className={`w-3.5 h-3.5 ${muted ? "text-muted-foreground" : "text-orange-500"}`} />
      {title}
    </p>
    {children}
  </div>
);

export default ProductosCremacion;
