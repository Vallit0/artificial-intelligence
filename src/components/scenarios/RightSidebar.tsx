import { Flame, Crown, Heart, Zap, Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface RightSidebarProps {
  streak?: number;
  xp?: number;
  lives?: number;
}

const RightSidebar = ({ streak = 0, xp = 0, lives = 5 }: RightSidebarProps) => {
  return (
    <aside className="hidden xl:flex flex-col w-80 min-h-screen p-4 space-y-4 fixed right-0 top-0 bottom-0 overflow-y-auto">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-end gap-3 py-2">
        {/* Streak */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-bold text-foreground">{streak}</span>
        </div>

        {/* XP/Gems */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Crown className="w-5 h-5 text-turquoise" />
          <span className="text-sm font-bold text-foreground">{xp}</span>
        </div>

        {/* Lives */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Heart className="w-5 h-5 text-destructive fill-destructive" />
          <span className="text-sm font-bold text-foreground">{lives}</span>
        </div>
      </div>

      {/* Unlock Leaderboards Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">¡Desbloquea la Clasificación!</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Completa 10 lecciones más para comenzar a competir
          </p>
        </CardContent>
      </Card>

      {/* Daily Quests Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold">Misiones Diarias</CardTitle>
          <Button variant="link" className="text-turquoise p-0 h-auto font-bold text-sm">
            VER TODO
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-gold" />
            <div className="flex-1">
              <p className="text-sm font-medium">Gana 10 XP</p>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={30} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">3 / 10</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Promo Card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 text-primary-foreground overflow-hidden">
        <CardContent className="p-4 relative">
          {/* Decorative circles */}
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-turquoise/30" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-lime/20" />
          
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">¿Quieres más práctica?</h3>
            <p className="text-sm opacity-90 mb-3">
              Actualiza a Premium para acceso ilimitado a todos los escenarios
            </p>
            <Button 
              variant="secondary" 
              className="w-full font-bold"
            >
              OBTENER PREMIUM
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
};

export default RightSidebar;
