import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useStudents } from "@/hooks/useStudents";
import { Loader2, LogOut, Plus, Shield, Upload, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import StudentList from "@/components/admin/StudentList";
import CreateUserModal from "@/components/admin/CreateUserModal";
import BulkUploadModal from "@/components/admin/BulkUploadModal";

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { students, isLoading: studentsLoading, assignGrade, refetch } = useStudents();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

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

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/scenarios" replace />;
  }

  // Calculate summary stats
  const totalStudents = students.length;
  const studentsWithSessions = students.filter((s) => s.totalSessions > 0).length;
  const gradedStudents = students.filter((s) => s.finalGrade !== null).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Panel de Administrador</h1>
              <p className="text-sm text-muted-foreground">Gestión de estudiantes y certificados</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Estudiantes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Con Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{studentsWithSessions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Calificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{gradedStudents}</p>
            </CardContent>
          </Card>
        </div>

        {/* Students List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Estudiantes</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBulkModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Carga Masiva
              </Button>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
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
                  students={students}
                  onAssignGrade={assignGrade}
                  onRefetch={refetch}
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

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
