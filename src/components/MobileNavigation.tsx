import { useLocation, useNavigate } from "react-router-dom";
import { Users, Phone, TrendingUp, Settings, Lock, ArrowRightLeft, Building2, GraduationCap, Search, MessageCircleQuestion } from "lucide-react";
import { CREMACION_ACCENT_BG, CremacionIcon } from "@/lib/cremacion-theme";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLevelMode, useDidLevelJustChange, levelLabel } from "@/hooks/useLevelMode";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const MobileNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, roles } = useAuth();
  const isCoach = roles.includes("coach");
  const isLearner = roles.includes("learner");
  const canSeePanel = isAdmin || isCoach;
  const { currentLevel, toggle, canSwitchLevel, currentTrack, isCremacion, toggleTrack } = useLevelMode();
  const animateLevelChange = useDidLevelJustChange();

  const isLevel2 = currentLevel === 2;

  const level1Items: NavItem[] = [
    { icon: <Users className="w-5 h-5" />, label: "Prospectar", href: "/prospecting" },
    { icon: <Phone className="w-5 h-5" />, label: "Llamada", href: "/practice" },
    ...(user
      ? [
          { icon: <Lock className="w-5 h-5" />, label: "Examen", href: "/quests" },
          { icon: <TrendingUp className="w-5 h-5" />, label: "Progreso", href: "/progress" },
        ]
      : []),
  ];

  const level2Items: NavItem[] = [
    { icon: <Phone className="w-5 h-5" />, label: "Llamada", href: "/practice" },
    ...(user
      ? [
          { icon: <TrendingUp className="w-5 h-5" />, label: "Progreso", href: "/progress" },
        ]
      : []),
  ];

  // Cremación (campaña): sin Examen ni Prospectar; con Productos y Dudas.
  const cremacionItems: NavItem[] = [
    { icon: <Phone className="w-5 h-5" />, label: "Llamada", href: "/practice" },
    { icon: <Search className="w-5 h-5" />, label: "Productos", href: "/productos" },
    { icon: <MessageCircleQuestion className="w-5 h-5" />, label: "Dudas", href: "/cremacion/dudas" },
    ...(user ? [{ icon: <TrendingUp className="w-5 h-5" />, label: "Progreso", href: "/progress" }] : []),
  ];

  const baseItems = isCremacion ? cremacionItems : isLevel2 ? level2Items : level1Items;
  const navItems: NavItem[] = [
    ...baseItems,
    ...(canSeePanel
      ? [
          { icon: <Settings className="w-5 h-5" />, label: isAdmin ? "Admin" : "Alumnos", href: "/admin" },
        ]
      : []),
  ];

  const accentBg = isCremacion
    ? CREMACION_ACCENT_BG
    : isLevel2
      ? "linear-gradient(135deg, #a855f7, #ec4899)"
      : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))";

  return (
    <nav
      data-tour="nav-mobile"
      className="fixed bottom-0 left-0 right-0 py-2 px-1 lg:hidden z-30"
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {user && (user.sede || user.coach || isLearner || canSwitchLevel) && (
        <div className="flex items-center justify-center gap-3 pb-1.5 text-[11px] text-muted-foreground">
          {canSwitchLevel && (
            <button
              onClick={toggleTrack}
              aria-pressed={isCremacion}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider text-[10px] transition-colors ${
                isCremacion
                  ? "text-white border-transparent"
                  : "text-muted-foreground border-border bg-white/60"
              }`}
              style={isCremacion ? { background: CREMACION_ACCENT_BG } : undefined}
              title={isCremacion ? "Volver al producto tradicional" : "Entrenar la línea Cremación"}
            >
              <CremacionIcon className="w-3 h-3 shrink-0" />
              Cremación {isCremacion ? "ON" : "OFF"}
            </button>
          )}
          {user.sede && (
            <span className="flex items-center gap-1 truncate max-w-[45%]">
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{user.sede.name}</span>
            </span>
          )}
          {(user.coach || isLearner) && (
            <span className="flex items-center gap-1 truncate max-w-[45%]">
              <GraduationCap className="w-3 h-3 shrink-0" />
              <span className="truncate">{user.coach ? user.coach.name : "Sin coach"}</span>
            </span>
          )}
        </div>
      )}
      <div key={`mobile-nav-${currentLevel}-${currentTrack}`} className="flex items-center justify-around">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-all duration-200 min-w-0",
                isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
              )}
              style={{
                ...(isActive ? { background: accentBg } : {}),
                animation: animateLevelChange
                  ? `mobileNavPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s both`
                  : undefined,
              }}
            >
              {item.icon}
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
        {canSwitchLevel && (
          <button
            onClick={toggle}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-all duration-200 text-muted-foreground hover:text-foreground min-w-0"
            title={`Cambiar a ${levelLabel(currentLevel === 1 ? 2 : 1)}`}
            style={{
              animation: animateLevelChange
                ? "mobileNavPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both"
                : undefined,
            }}
          >
            <ArrowRightLeft className="w-5 h-5" />
            <span className="text-xs font-semibold">{currentLevel === 1 ? "Objec." : "Prosp."}</span>
          </button>
        )}
      </div>
      <style>{`
        @keyframes mobileNavPop {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </nav>
  );
};

export default MobileNavigation;
