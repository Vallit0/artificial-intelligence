import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Trophy, Target, ShoppingBag, User, MoreHorizontal } from "lucide-react";
import logoSenoriales from "@/assets/logo-senoriales.png";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
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
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-sidebar-background border-r border-sidebar-border fixed left-0 top-0 bottom-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoSenoriales} alt="Logo" className="h-10" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
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
                  ? "bg-sidebar-primary/20 text-sidebar-primary border-2 border-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/10"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "text-sidebar-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default LeftSidebar;
