import { useLocation, useNavigate } from "react-router-dom";
import { Users, Phone, Target, TrendingUp, Settings, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const MobileNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const navItems: NavItem[] = [
    {
      icon: <Users className="w-5 h-5" />,
      label: "Prospectar",
      href: "/prospecting",
    },
    {
      icon: <Phone className="w-5 h-5" />,
      label: "Llamada",
      href: "/practice",
    },
    ...(user
      ? [
          {
            icon: <BookOpen className="w-5 h-5" />,
            label: "Legado",
            href: "/legado",
          },
          {
            icon: <Target className="w-5 h-5" />,
            label: "Evaluación",
            href: "/quests",
          },
          {
            icon: <TrendingUp className="w-5 h-5" />,
            label: "Progreso",
            href: "/progress",
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            icon: <Settings className="w-5 h-5" />,
            label: "Admin",
            href: "/admin",
          },
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 py-2 px-2 lg:hidden z-30" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon}
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
