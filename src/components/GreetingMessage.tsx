import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

const greetings = [
  "¡Hola",
  "¡Bienvenido de vuelta",
  "¡Qué gusto verte",
  "¡Genial tenerte aquí",
  "¡Listo para practicar",
  "¡Hoy es un gran día",
];

const GreetingMessage = () => {
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
  }, []);

  const userName = useMemo(() => {
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return null;
  }, [user]);

  if (!userName) return null;

  return (
    <span className="text-sm font-medium text-foreground hidden sm:inline">
      {greeting}, <span className="text-primary font-semibold">{userName}</span>! 👋
    </span>
  );
};

export default GreetingMessage;
