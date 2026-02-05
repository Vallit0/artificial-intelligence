 import { useLocation, useNavigate } from "react-router-dom";
 import { Home, Users, Phone, Target, TrendingUp } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface NavItem {
   icon: React.ReactNode;
   label: string;
   href: string;
 }
 
 const navItems: NavItem[] = [
   { 
     icon: <Users className="w-5 h-5" />, 
     label: "Prospectar", 
     href: "/prospecting" 
   },
   { 
     icon: <Phone className="w-5 h-5" />, 
     label: "Llamada", 
     href: "/practice" 
   },
   { 
     icon: <Target className="w-5 h-5" />, 
     label: "Evaluación", 
     href: "/quests" 
   },
   { 
     icon: <TrendingUp className="w-5 h-5" />, 
     label: "Progreso", 
     href: "/progress" 
   },
 ];
 
 const MobileNavigation = () => {
   const location = useLocation();
   const navigate = useNavigate();
 
   return (
     <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border py-2 px-2 lg:hidden shadow-lg z-30">
       <div className="flex items-center justify-around">
         {navItems.map((item) => {
           const isActive = location.pathname === item.href;
           return (
             <button
               key={item.href}
               onClick={() => navigate(item.href)}
               className={cn(
                 "flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200",
                 isActive 
                   ? "text-secondary bg-secondary/10" 
                   : "text-muted-foreground hover:text-foreground hover:bg-muted"
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