import { Flame, Crown, Heart, Zap, Lock, GraduationCap, ExternalLink, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { startOfWeek, eachDayOfInterval, endOfWeek, isSameDay, format } from "date-fns";
import { es } from "date-fns/locale";

interface RightSidebarProps {
  streak?: number;
  xp?: number;
  lives?: number;
  moodleUrl?: string;
  practiceDays?: Date[];
}

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const RightSidebar = ({ streak = 0, xp = 0, lives = 5, moodleUrl = "#", practiceDays = [] }: RightSidebarProps) => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hasPracticedOnDay = (day: Date) => {
    return practiceDays.some((practiceDay) => isSameDay(practiceDay, day));
  };

  return (
    <aside className="hidden xl:flex flex-col w-80 min-h-screen p-5 space-y-5 fixed right-0 top-0 bottom-0 overflow-y-auto bg-background">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-end gap-4 py-3 px-2 bg-card rounded-2xl border border-border">
        {/* Streak with HoverCard */}
        <HoverCard openDelay={100} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-bold text-foreground">{streak}</span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-64 p-4" side="bottom" align="center">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="font-bold text-foreground">
                  Racha de {streak} {streak === 1 ? "día" : "días"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Días que has practicado esta semana:
              </p>
              <div className="flex justify-between gap-1">
                {daysOfWeek.map((day, index) => {
                  const practiced = hasPracticedOnDay(day);
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {WEEKDAY_LABELS[index]}
                      </span>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          practiced
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground"
                        } ${isToday ? "ring-2 ring-secondary ring-offset-2 ring-offset-background" : ""}`}
                      >
                        {practiced ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-xs">{format(day, "d")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>

        {/* XP/Gems */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
          <Crown className="w-5 h-5 text-secondary" />
          <span className="text-sm font-bold text-foreground">{xp}</span>
        </div>

        {/* Lives */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
          <Heart className="w-5 h-5 text-destructive fill-destructive" />
          <span className="text-sm font-bold text-foreground">{lives}</span>
        </div>
      </div>

      {/* Unlock Leaderboards Card */}
      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">¡Desbloquea la Clasificación!</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Completa 10 lecciones más para comenzar a competir
          </p>
        </CardContent>
      </Card>

      {/* Daily Quests Card */}
      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground">Misiones Diarias</CardTitle>
          <Button variant="link" className="text-secondary p-0 h-auto font-bold text-sm hover:text-secondary/80">
            VER TODO
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Gana 10 XP</p>
              <div className="flex items-center gap-3 mt-2">
                <Progress value={30} className="h-2.5 flex-1" />
                <span className="text-xs font-medium text-muted-foreground">3 / 10</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moodle Promo Card */}
      <Card className="bg-gradient-to-br from-primary via-primary to-primary/90 border-0 text-primary-foreground overflow-hidden shadow-lg">
        <CardContent className="p-5 relative">
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-secondary/20" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-lime/15" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-6 h-6" />
              <h3 className="font-bold text-lg">Visita el Moodle</h3>
            </div>
            <p className="text-sm opacity-90 mb-4 leading-relaxed">
              Accede a tus cursos completos y materiales adicionales en la plataforma de aprendizaje
            </p>
            <Button 
              variant="secondary" 
              className="w-full font-bold shadow-md hover:shadow-lg transition-shadow"
              onClick={() => window.open(moodleUrl, '_blank')}
            >
              <span>IR A MIS CURSOS</span>
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
};

export default RightSidebar;
