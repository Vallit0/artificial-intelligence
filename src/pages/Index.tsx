import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import FeatureBadge from "@/components/FeatureBadge";
import { Mic, Clock, Award, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight animate-fade-in">
                Entrena tus
                <br />
                <span className="text-primary">Habilidades</span>
                <br />
                de Venta
              </h1>

              {/* Decorative dots */}
              <div className="flex gap-2">
                <div className="w-10 h-4 rounded-full bg-foreground" />
                <div className="w-4 h-4 rounded-full bg-primary" />
                <div className="w-4 h-4 rounded-full bg-secondary" />
              </div>

              <p className="text-lg text-muted-foreground max-w-md">
                Practica conversaciones de venta con IA y mejora tu técnica.
                Completa 2 horas de práctica para obtener tu certificación.
              </p>

              <Link to="/practice">
                <Button size="lg" className="rounded-full px-8">
                  Comenzar Práctica
                </Button>
              </Link>

              {/* Stats */}
              <div className="flex gap-12 pt-8">
                <StatCard value="500+" label="Asesores capacitados" />
                <StatCard value="2hrs" label="Meta de certificación" />
              </div>
            </div>

            {/* Right Content - Decorative */}
            <div className="relative hidden lg:block">
              {/* Yellow blob */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-secondary rounded-full blur-3xl opacity-60" />

              {/* Feature badges */}
              <div className="relative z-10 space-y-4 ml-auto max-w-xs">
                <FeatureBadge>
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    Práctica con IA
                  </div>
                </FeatureBadge>
                <FeatureBadge>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Seguimiento de tiempo
                  </div>
                </FeatureBadge>
                <FeatureBadge>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Certificación
                  </div>
                </FeatureBadge>
                <FeatureBadge>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Integración Moodle
                  </div>
                </FeatureBadge>
              </div>

              {/* Info card */}
              <div className="absolute bottom-0 right-0 bg-card border border-border rounded-2xl p-6 shadow-lg max-w-xs">
                <h3 className="font-semibold text-foreground mb-2">
                  Entrenamiento Interactivo
                </h3>
                <p className="text-sm text-muted-foreground">
                  Practica con clientes virtuales que simulan objeciones reales
                  y aprende a cerrar más ventas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Plataforma diseñada para Capillas Señoriales
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
            Entrena a tu equipo de ventas con conversaciones realistas
            impulsadas por inteligencia artificial.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Conversación Natural
              </h3>
              <p className="text-sm text-muted-foreground">
                Habla con la IA como si fuera un cliente real usando tu
                micrófono.
              </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border">
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Clock className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Tracking de Tiempo
              </h3>
              <p className="text-sm text-muted-foreground">
                Acumula tus 2 horas de práctica para obtener tu certificación.
              </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Award className="w-6 h-6 text-olive-dark" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Certificación
              </h3>
              <p className="text-sm text-muted-foreground">
                Obtén tu certificado al completar las horas requeridas de
                entrenamiento.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
