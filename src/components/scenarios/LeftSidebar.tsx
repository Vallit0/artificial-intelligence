import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Phone,
  LogOut,
  TrendingUp,
  Users,
  Settings,
  Lock,
  ArrowRightLeft,
  Building2,
  Boxes,
  GraduationCap,
  HelpCircle,
  Search,
  MessageCircleQuestion,
} from "lucide-react";
import { CREMACION_ACCENT_BG, CremacionIcon } from "@/lib/cremacion-theme";
import logoSenoriales from "@/assets/logo-senoriales.png";
import { useAuth } from "@/hooks/useAuth";
import { useLevelMode, useDidLevelJustChange, levelLabel, moduleLabel } from "@/hooks/useLevelMode";
import { startTutorial } from "@/lib/tutorial";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  disabled?: boolean;
}

const LeftSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, roles, user } = useAuth();
  const isCoach = roles.includes("coach");
  const isLearner = roles.includes("learner");
  const canSeePanel = isAdmin || isCoach;
  const { currentLevel, toggle, canSwitchLevel, currentTrack, isCremacion, toggleTrack } = useLevelMode();
  const animateLevelChange = useDidLevelJustChange();

  const isLevel2 = currentLevel === 2;

  const level1Items: NavItem[] = [
    { icon: Users, label: "Prospeccion", href: "/prospecting" },
    { icon: Phone, label: "Llamada", href: "/practice" },
    { icon: Lock, label: "Examen Final", href: "/quests" },
    { icon: TrendingUp, label: "Mi Progreso", href: "/progress" },
  ];

  const level2Items: NavItem[] = [
    { icon: Phone, label: "Llamada", href: "/practice" },
    { icon: GraduationCap, label: "Examen Final", href: "/examen-objeciones" },
    { icon: TrendingUp, label: "Mi Progreso", href: "/progress" },
  ];

  // Pista Cremación (campaña): sin Examen Final ni Escenarios de Prospección.
  // Se agregan el buscador de productos y las dudas frecuentes.
  const cremacionItems: NavItem[] = [
    { icon: Phone, label: "Llamada", href: "/practice" },
    { icon: Search, label: "Productos", href: "/productos" },
    { icon: MessageCircleQuestion, label: "Dudas Frecuentes", href: "/cremacion/dudas" },
    { icon: TrendingUp, label: "Mi Progreso", href: "/progress" },
  ];

  const baseItems = isCremacion ? cremacionItems : isLevel2 ? level2Items : level1Items;
  const navItems: NavItem[] = [
    ...baseItems,
    ...(canSeePanel
      ? [
          { icon: Settings, label: isAdmin ? "Admin" : "Mis Alumnos", href: "/admin" },
        ]
      : []),
  ];

  // Theme tokens — Level 2 uses a violet/pink accent palette while keeping
  // the same overall structure so the user can tell they're in a new "world".
  // Cremación pinta todo en naranja, sin importar el módulo.
  const accentBg = isCremacion
    ? CREMACION_ACCENT_BG
    : isLevel2
      ? "linear-gradient(135deg, #a855f7, #ec4899)"
      : "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(var(--sidebar-accent)))";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  // Reproduce el tour guiado on-demand. Navega a /practice (donde viven los
  // anclajes data-tour); OnboardingTour consume el flag al montarse.
  const handleTutorial = () => {
    startTutorial();
    navigate("/practice");
  };

  return (
    <aside
      data-tour="nav-desktop"
      className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 bottom-0 z-40 overflow-y-auto"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
      }}
    >
      {/* Logo */}
      <div className="px-5 py-6" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}>
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src={logoSenoriales} alt="Señoriales" className="h-10" />
          <span
            className="text-sm font-bold leading-tight"
            style={{ color: "hsl(var(--sidebar-foreground))" }}
          >
            Centro de Negocios
            <br />
            Señoriales
          </span>
        </Link>
        <div
          key={`level-badge-${currentLevel}-${currentTrack}`}
          className="mt-3 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-center"
          style={{
            background: accentBg,
            color: "white",
            animation: animateLevelChange
              ? "navItemPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : undefined,
          }}
        >
          {moduleLabel(currentLevel, currentTrack)}
        </div>
      </div>

      {/* Module toggle — todos los usuarios pueden alternar entre Prospección y
          Objeciones. */}
      {canSwitchLevel && (
        <div className="px-3 pt-3">
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:bg-white/[0.06]"
            style={{
              color: "hsl(var(--sidebar-foreground) / 0.7)",
              border: "1px dashed hsl(var(--sidebar-border))",
            }}
            title="Cambiar entre Prospección y Objeciones"
          >
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Cambiar a {levelLabel(currentLevel === 1 ? 2 : 1)}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              style={{ background: accentBg, color: "white" }}
            >
              {levelLabel(currentLevel)}
            </span>
          </button>
        </div>
      )}

      {/* Pista Cremación: se activa encima del módulo actual (Prospección u
          Objeciones). Cambia coach/role plays, paleta y habilita Productos. */}
      {canSwitchLevel && (
        <div className="px-3 pt-2">
          <button
            onClick={toggleTrack}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:bg-white/[0.06]"
            style={{
              color: isCremacion ? "#fdba74" : "hsl(var(--sidebar-foreground) / 0.7)",
              border: isCremacion ? "1px solid rgba(249,115,22,0.45)" : "1px dashed hsl(var(--sidebar-border))",
              background: isCremacion ? "rgba(249,115,22,0.08)" : undefined,
            }}
            title={isCremacion ? "Volver al producto tradicional" : "Entrenar la línea Cremación"}
            aria-pressed={isCremacion}
          >
            <span className="flex items-center gap-2">
              <CremacionIcon className="w-3.5 h-3.5" />
              Cremación
            </span>
            <span
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                background: isCremacion ? CREMACION_ACCENT_BG : "hsl(var(--sidebar-border))",
              }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: isCremacion ? "translateX(18px)" : "translateX(2px)" }}
              />
            </span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav key={`nav-items-${currentLevel}-${currentTrack}`} className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          const itemAnim = animateLevelChange
            ? `navItemPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s both`
            : undefined;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm cursor-not-allowed opacity-40"
                style={{
                  color: "hsl(var(--sidebar-foreground))",
                  animation: itemAnim,
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200",
                isActive ? "shadow-lg" : "hover:bg-white/[0.06]",
              )}
              style={{
                ...(isActive
                  ? { background: accentBg, color: "white" }
                  : { color: "hsl(var(--sidebar-foreground) / 0.7)" }),
                animation: itemAnim,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget.style.color = "hsl(var(--sidebar-foreground))");
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget.style.color = "hsl(var(--sidebar-foreground) / 0.7)");
              }}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sede + división + coach asignado */}
      {user && (user.sede || isLearner || user.coach || user.division) && (
        <div
          className="px-4 pt-3 space-y-1.5"
          style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}
        >
          {user.sede && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.65)" }}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium">{user.sede.name}</span>
            </div>
          )}
          {user.division && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.65)" }}
            >
              <Boxes className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{user.division.name}</span>
            </div>
          )}
          {(user.coach || isLearner) && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.65)" }}
            >
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {user.coach ? user.coach.name : "Sin coach asignado"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tutorial + Logout */}
      <div className="px-3 pb-3" style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
        <button
          onClick={handleTutorial}
          className="flex items-center gap-3 w-full px-4 py-3 mt-3 rounded-2xl text-sm font-medium transition-all duration-200 hover:bg-white/[0.06]"
          style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}
          title="Ver el tutorial guiado paso a paso"
        >
          <HelpCircle className="w-5 h-5" />
          <span>Tutorial</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 mt-3 rounded-2xl text-sm font-medium transition-all duration-200 hover:bg-white/[0.06]"
          style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(0 70% 60%)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(var(--sidebar-foreground) / 0.5)")}
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesion</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        <p className="text-[11px] text-center" style={{ color: "hsl(var(--sidebar-foreground) / 0.3)" }}>
          Centro de Negocios Senoriales
        </p>
      </div>

      <style>{`
        @keyframes navItemPop {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </aside>
  );
};

export default LeftSidebar;
