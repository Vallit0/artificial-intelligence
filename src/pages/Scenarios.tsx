import { useNavigate } from "react-router-dom";
import { useScenarios } from "@/hooks/useScenarios";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Clock, AlertCircle, ChevronRight } from "lucide-react";

const difficultyColors: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-red-500/20 text-red-400 border-red-500/30",
};

const difficultyLabels: Record<string, string> = {
  easy: "Fácil",
  medium: "Intermedio",
  hard: "Difícil",
};

export default function Scenarios() {
  const navigate = useNavigate();
  const { scenarios, isLoading, error } = useScenarios();

  const handleSelectScenario = (scenarioId: string) => {
    navigate(`/practice?scenario=${scenarioId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Escenarios de Práctica
          </h1>
          <p className="text-muted-foreground">
            Selecciona un escenario para practicar el manejo de objeciones
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {scenarios.map((scenario) => (
              <Card 
                key={scenario.id} 
                className="group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleSelectScenario(scenario.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">
                      {scenario.name}
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className={difficultyColors[scenario.difficulty]}
                    >
                      {difficultyLabels[scenario.difficulty]}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    Objeción: "{scenario.objection}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {scenario.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>~5 min práctica</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="group-hover:bg-primary group-hover:text-primary-foreground"
                    >
                      Practicar
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
