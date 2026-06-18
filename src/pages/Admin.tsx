import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useStudents } from "@/hooks/useStudents";
import { Activity, BarChart3, Building2, Clock, Download, GraduationCap, Loader2, Play, Plus, Search, Shield, Timer, Upload, UserCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentList from "@/components/admin/StudentList";
import CreateUserModal from "@/components/admin/CreateUserModal";
import BulkUploadModal from "@/components/admin/BulkUploadModal";
import AgentConfigPanel from "@/components/admin/AgentConfigPanel";
import ProspectingScenariosPanel from "@/components/admin/ProspectingScenariosPanel";
import AiAccessPanel from "@/components/admin/AiAccessPanel";
import LatencyTesterPanel from "@/components/admin/LatencyTesterPanel";
import AgentLatencyPanel from "@/components/admin/AgentLatencyPanel";
import SedesPanel from "@/components/admin/SedesPanel";
import CoachesPanel from "@/components/admin/CoachesPanel";
import PendingApprovalsPanel from "@/components/admin/PendingApprovalsPanel";
import CoachStudentsPanel from "@/components/admin/CoachStudentsPanel";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import { useAdminUsage } from "@/hooks/useAdminUsage";
import { useTimeByMode } from "@/hooks/useTimeByMode";
import { useCoaches } from "@/hooks/useCoaches";
import { UsageAnalytics } from "@/components/analytics/UsageAnalytics";
import { TimeByModeAnalytics } from "@/components/analytics/TimeByModeAnalytics";
import { PeriodFilter } from "@/components/analytics/PeriodFilter";
import { exportStudentsToExcel } from "@/lib/export-students";
import { exportUsageToExcel } from "@/lib/export-usage";
import { EMPTY_PERIOD, type Period } from "@/lib/period";

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
  const { students, isLoading: studentsLoading, assignGrade, toggleExamenFinal, bulkToggleExamenFinal, assignCoach, updateUser, refetch } = useStudents(period);
  // Sólo admin global puede asignar coaches; gateamos el fetch para no
  // disparar un 403 en coaches sin permiso de listado.
  const { coaches } = useCoaches(isAdmin);

  const { data: usageData, isLoading: usageLoading } = useAdminUsage(period);
  const { data: timeByModeData, isLoading: timeByModeLoading, error: timeByModeError } = useTimeByMode(period);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen animate-fade-in">
        <ScrollArea className="h-screen">
          <div className="max-w-7xl mx-auto px-4 py-6 pb-24 lg:pb-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
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
            </div>

            {isAdmin && (
              <div className="mb-6">
                <AiAccessPanel />
              </div>
            )}

        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
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
          </TabsList>

          <TabsContent value="students">
        {/* Filtro de período: acota sesiones/tiempo del listado al rango. */}
        <div className="mb-4">
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Estudiantes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">{studentsWithSessions} activos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Play className="w-4 h-4" />
                Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tiempo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{totalHours}h {totalMinutes}m</p>
              <p className="text-xs text-muted-foreground">de práctica</p>
            </CardContent>
          </Card>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...students]
                  .sort((a, b) => b.totalDuration - a.totalDuration)
                  .map((student, index) => {
                    const minutes = Math.floor(student.totalDuration / 60);
                    const hours = Math.floor(minutes / 60);
                    const remainingMins = minutes % 60;
                    const timeStr = hours > 0 ? `${hours}h ${remainingMins}m` : `${minutes}m`;
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : index === 1
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            : index === 2
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
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
                      </div>
                    );
                  })}
                {students.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                    No hay asesores registrados
                  </p>
                )}
              </div>
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
                  onClick={() => exportStudentsToExcel(students)}
                  disabled={students.length === 0}
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
                  <Button size="sm" onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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
                  students={students.filter((s) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      [s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase().includes(q) ||
                      (s.email || "").toLowerCase().includes(q)
                    );
                  })}
                  onAssignGrade={assignGrade}
                  onToggleExamenFinal={toggleExamenFinal}
                  onBulkToggleExamenFinal={bulkToggleExamenFinal}
                  onRefetch={refetch}
                  coaches={coaches}
                  canAssignCoach={isAdmin}
                  onAssignCoach={assignCoach}
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
                <UsageAnalytics data={usageData} />
                <TimeByModeAnalytics
                  data={timeByModeData}
                  isLoading={timeByModeLoading}
                  error={timeByModeError}
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
    </div>
  );
}
