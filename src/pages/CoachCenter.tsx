import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import {
  useCitas,
  useCitaUsers,
  useCitaDirectors,
  useCreateCita,
  useUpdateCita,
  useDeleteCita,
  Cita,
  CitaInput,
} from "@/hooks/useCitas";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { Loader2, CalendarDays } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import CalendarHeader from "@/components/coach-center/CalendarHeader";
import WeeklyCalendar from "@/components/coach-center/WeeklyCalendar";
import CitaFormDialog from "@/components/coach-center/CitaFormDialog";

export default function CoachCenter() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { isAdmin: confirmedAdmin, isLoading: adminLoading } = useAdmin();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDirector, setSelectedDirector] = useState("todos");
  const [selectedPrioridad, setSelectedPrioridad] = useState("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCita, setEditingCita] = useState<Cita | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: citas = [], isLoading: citasLoading } = useCitas(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    {
      director: selectedDirector !== "todos" ? selectedDirector : undefined,
      prioridad: selectedPrioridad !== "todas" ? selectedPrioridad : undefined,
    }
  );

  const { data: users = [] } = useCitaUsers();
  const { data: directors = [] } = useCitaDirectors();

  const createMutation = useCreateCita();
  const updateMutation = useUpdateCita();
  const deleteMutation = useDeleteCita();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!confirmedAdmin) return <Navigate to="/practice" replace />;

  const handleAddCita = () => {
    setEditingCita(null);
    setFormOpen(true);
  };

  const handleEditCita = (cita: Cita) => {
    setEditingCita(cita);
    setFormOpen(true);
  };

  const handleDeleteCita = (id: string) => {
    if (!confirm("Eliminar esta cita?")) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Cita eliminada"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSubmit = (data: CitaInput) => {
    if (editingCita) {
      updateMutation.mutate(
        { id: editingCita.id, ...data },
        {
          onSuccess: () => {
            toast.success("Cita actualizada");
            setFormOpen(false);
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success("Cita creada");
          setFormOpen(false);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen animate-fade-in">
        <ScrollArea className="h-screen">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Coach Center</h1>
                <p className="text-sm text-muted-foreground">
                  Calendario de citas de asesores
                </p>
              </div>
            </div>

            {/* Calendar controls */}
            <CalendarHeader
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              directors={directors}
              selectedDirector={selectedDirector}
              onDirectorChange={setSelectedDirector}
              selectedPrioridad={selectedPrioridad}
              onPrioridadChange={setSelectedPrioridad}
              onAddCita={handleAddCita}
            />

            {/* Calendar grid */}
            {citasLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <WeeklyCalendar
                currentDate={currentDate}
                citas={citas}
                isAdmin={isAdmin}
                onEditCita={handleEditCita}
                onDeleteCita={handleDeleteCita}
              />
            )}
          </div>
        </ScrollArea>
      </main>

      <MobileNavigation />

      {/* Form dialog */}
      <CitaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cita={editingCita}
        users={users}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
