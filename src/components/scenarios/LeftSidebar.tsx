import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Target, Phone, LogOut, TrendingUp, Users } from "lucide-react";
import logoSenoriales from "@/assets/logo-senoriales.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { icon: Users, label: "PROSPECCIÓN", href: "/prospecting" },
  { icon: Phone, label: "LLAMADA", href: "/practice" },
  { icon: Target, label: "EVALUACIÓN", href: "/quests" },
  { icon: TrendingUp, label: "MI PROGRESO", href: "/progress" },
];

const LeftSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-card border-r border-border fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src={logoSenoriales} alt="Señoriales" className="h-10" />
          <span className="text-sm font-bold text-primary leading-tight">Centro de Negocios<br />Señoriales</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm cursor-not-allowed opacity-50"
              >
                <Icon className="w-6 h-6 text-muted-foreground" />
                <span className="text-muted-foreground">{item.label}</span>
                <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  Próximamente
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200",
                isActive
                  ? "bg-secondary/15 text-secondary border-2 border-secondary"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "w-6 h-6 transition-colors",
                isActive ? "text-secondary" : "text-foreground/60"
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 px-4 py-3 h-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold text-sm">Cerrar Sesión</span>
        </Button>
      </div>

      {/* Footer */}
      <div className="p-4 pt-0">
        <p className="text-xs text-muted-foreground text-center">
          © Centro de Negocios Señoriales
        </p>
      </div>
    </aside>
  );
};

export default LeftSidebar;
