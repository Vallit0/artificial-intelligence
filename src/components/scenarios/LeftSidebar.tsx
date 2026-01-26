import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Trophy, Target, ShoppingBag, User, MoreHorizontal } from "lucide-react";
import logoSenoriales from "@/assets/logo-senoriales.png";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: "APRENDER", href: "/scenarios" },
  { icon: Trophy, label: "CLASIFICACIÓN", href: "/leaderboards" },
  { icon: Target, label: "MISIONES", href: "/quests" },
  { icon: ShoppingBag, label: "TIENDA", href: "/shop" },
  { icon: User, label: "PERFIL", href: "/profile" },
  { icon: MoreHorizontal, label: "MÁS", href: "/more" },
];

const LeftSidebar = () => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-card border-r border-border fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src={logoSenoriales} alt="Señoriales" className="h-10" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

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

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © Centro de Negocios Señoriales
        </p>
      </div>
    </aside>
  );
};

export default LeftSidebar;
