import { useState, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useStudents } from "@/hooks/useStudents";
import { Activity, BarChart3, Boxes, Building2, ChevronRight, Clock, Download, GraduationCap, HelpCircle, Loader2, Play, Plus, Search, Settings, Shield, Timer, Upload, UserCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudentList from "@/components/admin/StudentList";
import CreateUserModal from "@/components/admin/CreateUserModal";
import BulkUploadModal from "@/components/admin/BulkUploadModal";
import AgentConfigPanel from "@/components/admin/AgentConfigPanel";
import ProspectingScenariosPanel from "@/components/admin/ProspectingScenariosPanel";
import AiAccessPanel from "@/components/admin/AiAccessPanel";
import LatencyTesterPanel from "@/components/admin/LatencyTesterPanel";
import AgentLatencyPanel from "@/components/admin/AgentLatencyPanel";
import SedesPanel from "@/components/admin/SedesPanel";
import DivisionsPanel from "@/components/admin/DivisionsPanel";
import CoachesPanel from "@/components/admin/CoachesPanel";
import PracticeByAgentModal, { type BreakdownMetric } from "@/components/admin/PracticeByAgentModal";
import PendingApprovalsPanel from "@/components/admin/PendingApprovalsPanel";
import CoachStudentsPanel from "@/components/admin/CoachStudentsPanel";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import AdminTour, { startAdminTutorial } from "@/components/onboarding/AdminTour";
import ConfigPanel from "@/components/admin/ConfigPanel";
import { useAdminUsage } from "@/hooks/useAdminUsage";
import { useTimeByMode } from "@/hooks/useTimeByMode";
import { useDivisions } from "@/hooks/useDivisions";
import { UsageAnalytics } from "@/components/analytics/UsageAnalytics";
import { TimeByModeAnalytics } from "@/components/analytics/TimeByModeAnalytics";
import { TimeByModeBreakdown } from "@/components/analytics/TimeByModeBreakdown";
import { PeriodFilter } from "@/components/analytics/PeriodFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportStudentsToExcel } from "@/lib/export-students";
import { exportUsageToExcel } from "@/lib/export-usage";
import { EMPTY_PERIOD, type Period } from "@/lib/period";
import { EMPTY_TIME_BY_MODE } from "@/lib/time-by-mode";

// Tarjeta de stat clickeable: abre el desglose por agente al click o con
// Enter/Espacio (accesible vía teclado). Muestra un chevron como afford.
function StatCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Ver desglose por tipo de llamada (agente)"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {icon}
            {label}
          </span>
          <ChevronRight className="w-4 h-4 opacity-50" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading, roles } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const isCoach = roles.includes("coach");
  const isCoachOnly = isCoach && !isAdmin;
  const canSeeProspecting = !isCoachOnly || !!user?.coachPermissions?.canEditPrompts;
  const canSeeCoachesTab = isAdmin || !!user?.coachPermissions?.canCreateCoaches;
  // Filtro de período compartido por las analíticas de uso, el listado de
  // estudiantes y el export a Excel. Vacío = histórico.
  const [period, setPeriod] = useState<Period>(EMPTY_PERIOD);
  const { students, isLoading: studentsLoading, assignGrade, toggleExamen, bulkToggleExamen, assignDivision, updateUser, refetch } = useStudents(period);
  // Sólo admin global asigna divisiones a estudiantes; gateamos el fetch para
  // no disparar un 403 sin permiso de listado.
  const { divisions } = useDivisions({ enabled: isAdmin });

  const { data: usageData, isLoading: usageLoading } = useAdminUsage(period);
  const { data: timeByModeData, isLoading: timeByModeLoading, error: timeByModeError } = useTimeByMode(period);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Filtros de la lista de estudiantes (client-side; la fecha va por `period`).
  const [sedeFilter, setSedeFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  // Buscador + detalle por asesor en la tarjeta "Minutos de Práctica por Asesor".
  const [advisorSearch, setAdvisorSearch] = useState("");
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | null>(null);
  // Tarjeta de stats clickeada → métrica a resaltar en el desglose por agente.
  const [openBreakdownMetric, setOpenBreakdownMetric] = useState<BreakdownMetric | null>(null);

  // Opciones de filtro derivadas de los estudiantes cargados (sede/división/país).
  const studentFilterOptions = useMemo(() => {
    const sedeMap = new Map<string, string>();
    const divisionMap = new Map<string, string>();
    const countrySet = new Set<string>();
    // Las divisiones salen de la lista real (admin) para aparecer aunque ningún
    // estudiante esté asignado todavía; el coach las toma de sus estudiantes.
    for (const d of divisions) {
      if (d.id && d.name) divisionMap.set(d.id, d.name);
    }
    for (const s of students) {
      if (s.sedeId && s.sedeName) sedeMap.set(s.sedeId, s.sedeName);
      if (s.divisionId && s.divisionName) divisionMap.set(s.divisionId, s.divisionName);
      if (s.country) countrySet.add(s.country);
    }
    return {
      sedes: Array.from(sedeMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      divisions: Array.from(divisionMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      countries: Array.from(countrySet).sort((a, b) => a.localeCompare(b)),
    };
  }, [students, divisions]);

  // Lista filtrada (búsqueda por nombre/email + sede + división + país). La fecha
  // ya viene aplicada server-side vía `period`. Se usa en la tabla y en el export.
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (sedeFilter !== "all" && s.sedeId !== sedeFilter) return false;
      if (divisionFilter !== "all" && s.divisionId !== divisionFilter) return false;
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      if (!q) return true;
      const name = [s.first_name, s.last_name].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || (s.email || "").toLowerCase().includes(q);
    });
  }, [students, searchQuery, sedeFilter, divisionFilter, countryFilter]);

  // Show loading while checking auth and admin status
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Solo admin global o coach pueden entrar. El backend ya filtra por sede;
  // acá ocultamos los tabs admin-only más abajo.
  if (!isAdmin && !isCoach) {
    return <Navigate to="/scenarios" replace />;
  }

  // Calculate summary stats
  const totalStudents = students.length;
  const studentsWithSessions = students.filter((s) => s.totalSessions > 0).length;

  // Estadísticas agregadas
  const totalSessions = students.reduce((sum, s) => sum + s.totalSessions, 0);
  const totalDurationSeconds = students.reduce((sum, s) => sum + s.totalDuration, 0);
  const totalHours = Math.floor(totalDurationSeconds / 3600);
  const totalMinutes = Math.floor((totalDurationSeconds % 3600) / 60);

  // Ranking de asesores por tiempo (rank fijo antes de filtrar por búsqueda).
  const advisorQuery = advisorSearch.trim().toLowerCase();
  const rankedAdvisors = [...students]
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .map((student, rank) => ({ student, rank }))
    .filter(({ student }) => {
      if (!advisorQuery) return true;
      const name = [student.first_name, student.last_name].filter(Boolean).join(" ").toLowerCase();
      return name.includes(advisorQuery) || (student.email ?? "").toLowerCase().includes(advisorQuery);
    });

  // Asesor seleccionado + su desglose por modo (del endpoint time-by-mode, que
  // ya respeta el período). Si no tiene sesiones, no aparece en byStudent → ceros.
  const selectedAdvisor = students.find((s) => s.id === selectedAdvisorId) ?? null;
  const selectedAdvisorTime =
    timeByModeData?.byStudent.find((s) => s.id === selectedAdvisorId) ?? EMPTY_TIME_BY_MODE;

  return (
    <div className="min-h-screen bg-background">
      {isAdmin && <AdminTour />}
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen animate-fade-in">
        <ScrollArea className="h-screen">
          <div className="max-w-7xl mx-auto px-4 py-6 pb-24 lg:pb-6">
            {/* Header */}
            <div data-tour="admin-header" className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {isAdmin ? "Panel de Administrador" : "Panel del Coach"}
                  </h1>
                  <p className="text-sm text-muted-foreground">Gestión de estudiantes y certificados</p>
                </div>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="gap-2" onClick={startAdminTutorial}>
                  <HelpCircle className="w-4 h-4" />
                  Ver tutorial
                </Button>
              )}
            </div>

            {isAdmin && (
              <div className="mb-6">
                <AiAccessPanel />
              </div>
            )}

        <Tabs defaultValue="students" className="space-y-4">
          <TabsList data-tour="admin-tabs" className="flex-wrap h-auto">
            <TabsTrigger value="students">Estudiantes</TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Pendientes
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="sedes" className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Sedes
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="divisions" className="flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5" />
                Divisiones
              </TabsTrigger>
            )}
            {canSeeCoachesTab && (
              <TabsTrigger value="coaches" className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                Coaches
              </TabsTrigger>
            )}
            <TabsTrigger value="coach-students" className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Coach / Estudiantes
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Analíticas
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="agents">Agentes IA</TabsTrigger>}
            {canSeeProspecting && (
              <TabsTrigger value="prospecting">Prospección</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="latency" className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                Latencia
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="agent-perf" className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                Performance Voz
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="config" className="flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                Configuración
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="students" data-tour="admin-students-table">
        {/* Filtro de período: acota sesiones/tiempo del listado al rango.
            El botón exporta la lista YA filtrada (período + sede/división/país). */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportStudentsToExcel(filteredStudents)}
            disabled={filteredStudents.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        {/* Stats Cards — clickables: abren el desglose de práctica por agente
            (tipo de llamada) resaltando la métrica de la tarjeta. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Estudiantes"
            value={`${totalStudents}`}
            hint={`${studentsWithSessions} activos`}
            onClick={() => setOpenBreakdownMetric("students")}
          />
          <StatCard
            icon={<Play className="w-4 h-4" />}
            label="Sesiones"
            value={`${totalSessions}`}
            hint="totales"
            onClick={() => setOpenBreakdownMetric("sessions")}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Tiempo Total"
            value={`${totalHours}h ${totalMinutes}m`}
            hint="de práctica"
            onClick={() => setOpenBreakdownMetric("time")}
          />

        </div>

        {/* Practice Minutes by Advisor */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Minutos de Práctica por Asesor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar asesor por nombre o email..."
                    value={advisorSearch}
                    onChange={(e) => setAdvisorSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-[28rem] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rankedAdvisors.map(({ student, rank }) => {
                      const minutes = Math.floor(student.totalDuration / 60);
                      const hours = Math.floor(minutes / 60);
                      const remainingMins = minutes % 60;
                      const timeStr = hours > 0 ? `${hours}h ${remainingMins}m` : `${minutes}m`;
                      return (
                        <button
                          type="button"
                          key={student.id}
                          onClick={() => setSelectedAdvisorId(student.id)}
                          className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left w-full"
                        >
                          <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                            rank === 0
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : rank === 1
                              ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              : rank === 2
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {rank + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {[student.first_name, student.last_name].filter(Boolean).join(' ') || student.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {student.totalSessions} sesiones
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-primary">
                            <Clock className="w-3.5 h-3.5" />
                            {timeStr}
                          </div>
                        </button>
                      );
                    })}
                    {students.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                        No hay asesores registrados
                      </p>
                    )}
                    {students.length > 0 && rankedAdvisors.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                        Sin resultados para "{advisorSearch}"
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Students List */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-row items-center justify-between">
              <CardTitle>Estudiantes</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportStudentsToExcel(filteredStudents)}
                  disabled={filteredStudents.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setShowBulkModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Carga Masiva
                  </Button>
                )}
                {(isAdmin || !!user?.coachPermissions?.canCreateCoaches) && (
                  <Button data-tour="admin-new-user" size="sm" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Filtros: aparecen si hay al menos un valor para ese campo
                  (sede siempre; división/país según haya datos cargados). */}
              {studentFilterOptions.sedes.length > 0 && (
                <Select value={sedeFilter} onValueChange={setSedeFilter}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue placeholder="Sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sedes</SelectItem>
                    {studentFilterOptions.sedes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {studentFilterOptions.divisions.length > 0 && (
                <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue placeholder="División" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las divisiones</SelectItem>
                    {studentFilterOptions.divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {studentFilterOptions.countries.length > 0 && (
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="sm:w-36">
                    <SelectValue placeholder="País" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los países</SelectItem>
                    {studentFilterOptions.countries.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-400px)]">
              {studentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <StudentList
                  students={filteredStudents}
                  onAssignGrade={assignGrade}
                  onToggleExamen={toggleExamen}
                  onBulkToggleExamen={bulkToggleExamen}
                  onRefetch={refetch}
                  divisions={divisions}
                  canAssignDivision={isAdmin}
                  onAssignDivision={assignDivision}
                  isAdmin={isAdmin}
                  currentUserId={user.id}
                  canEditUser={isAdmin}
                  onUpdateUser={updateUser}
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="pending">
            <PendingApprovalsPanel />
          </TabsContent>

          <TabsContent value="analytics">
            {usageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : usageData ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <PeriodFilter value={period} onChange={setPeriod} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportUsageToExcel(usageData, timeByModeData, students, period)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
                <UsageAnalytics data={usageData} onMetricClick={setOpenBreakdownMetric} />
                <TimeByModeAnalytics
                  data={timeByModeData}
                  isLoading={timeByModeLoading}
                  error={timeByModeError}
                  period={period}
                />
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos analíticos disponibles</p>
            )}
          </TabsContent>

          <TabsContent value="coach-students">
            <CoachStudentsPanel canListCoaches={isAdmin} />
          </TabsContent>

          <TabsContent value="sedes">
            <SedesPanel />
          </TabsContent>

          <TabsContent value="divisions">
            <DivisionsPanel />
          </TabsContent>

          <TabsContent value="coaches">
            <CoachesPanel />
          </TabsContent>

          <TabsContent value="agents">
            <AgentConfigPanel />
          </TabsContent>

          {canSeeProspecting && (
            <TabsContent value="prospecting">
              <ProspectingScenariosPanel />
            </TabsContent>
          )}

          <TabsContent value="latency">
            <LatencyTesterPanel />
          </TabsContent>

          <TabsContent value="agent-perf">
            <AgentLatencyPanel />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="config">
              <ConfigPanel />
            </TabsContent>
          )}
        </Tabs>
          </div>
        </ScrollArea>
      </main>

      <MobileNavigation />

      {/* Modals */}
      <CreateUserModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={refetch}
      />

      <BulkUploadModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        onSuccess={refetch}
      />

      {/* Desglose de práctica por tipo de llamada (agente) — abierto desde las
          tarjetas de stats, resaltando la métrica de la tarjeta clickeada. */}
      <PracticeByAgentModal
        open={openBreakdownMetric !== null}
        metric={openBreakdownMetric ?? "time"}
        data={timeByModeData?.byMode ?? []}
        summary={timeByModeData?.summary ?? { students: 0, sessions: 0, seconds: 0 }}
        isLoading={timeByModeLoading}
        onOpenChange={(o) => !o && setOpenBreakdownMetric(null)}
      />

      {/* Detalle de tiempo por modo del asesor seleccionado */}
      <Dialog open={!!selectedAdvisorId} onOpenChange={(open) => { if (!open) setSelectedAdvisorId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedAdvisor
                ? [selectedAdvisor.first_name, selectedAdvisor.last_name].filter(Boolean).join(" ") || selectedAdvisor.email
                : "Asesor"}
            </DialogTitle>
          </DialogHeader>
          {selectedAdvisor && (
            <p className="-mt-2 mb-1 text-sm text-muted-foreground">
              {selectedAdvisor.totalSessions} sesiones · {Math.floor(selectedAdvisor.totalDuration / 3600) > 0
                ? `${Math.floor(selectedAdvisor.totalDuration / 3600)}h ${Math.floor((selectedAdvisor.totalDuration % 3600) / 60)}m`
                : `${Math.floor(selectedAdvisor.totalDuration / 60)}m`} en total
            </p>
          )}
          <TimeByModeBreakdown data={selectedAdvisorTime} title="Tiempo por modo" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
