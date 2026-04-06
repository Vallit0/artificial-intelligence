import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Target, Phone, LogOut, TrendingUp, Users, Settings, BookOpen } from "lucide-react";
import logoSenoriales from "@/assets/logo-senoriales.png";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  disabled?: boolean;
}

const LeftSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();

  const navItems: NavItem[] = [
    { icon: Users, label: "Prospeccion", href: "/prospecting" },
    { icon: Phone, label: "Llamada", href: "/practice" },
    { icon: BookOpen, label: "Legado de Vida", href: "/legado" },
    { icon: Target, label: "Evaluacion", href: "/quests" },
    { icon: TrendingUp, label: "Mi Progreso", href: "/progress" },
    ...(isAdmin ? [{ icon: Settings, label: "Admin", href: "/admin" }] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 bottom-0 z-40"
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm cursor-not-allowed opacity-40"
                style={{ color: "hsl(var(--sidebar-foreground))" }}
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
                isActive
                  ? "shadow-lg"
                  : "hover:bg-white/[0.06]"
              )}
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(var(--sidebar-accent)))",
                      color: "hsl(var(--sidebar-primary-foreground))",
                    }
                  : {
                      color: "hsl(var(--sidebar-foreground) / 0.7)",
                    }
              }
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

      {/* Logout */}
      <div className="px-3 pb-3" style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
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
    </aside>
  );
};

export default LeftSidebar;
