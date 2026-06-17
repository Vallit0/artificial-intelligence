import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, UserCheck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePendingUsers, PendingUser } from "@/hooks/usePendingUsers";

export default function PendingApprovalsPanel() {
  const { toast } = useToast();
  const { pending, isLoading, decide } = usePendingUsers();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fullName = (u: PendingUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

  const handleApprove = async (u: PendingUser) => {
    setBusyId(u.id);
    try {
      await decide(u.id, "approve");
      toast({ title: "Usuario aprobado", description: `${fullName(u)} ya puede iniciar sesión.` });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo aprobar",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const u = rejectTarget;
    setBusyId(u.id);
    try {
      await decide(u.id, "reject", rejectReason.trim() || undefined);
      toast({ title: "Registro rechazado", description: `Se notificó a ${u.email}.` });
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo rechazar",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          Pendientes de aprobación
          {pending.length > 0 && (
            <span className="ml-2 text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay registros pendientes de aprobación.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fullName(u)}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.sedeName ?? "Sin sede"}
                    {u.coachName ? ` · Coach: ${u.coachName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(u)}
                    disabled={busyId === u.id}
                  >
                    {busyId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectTarget(u)}
                    disabled={busyId === u.id}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {rejectTarget?.email} será marcado como rechazado y recibirá un correo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Motivo (opcional)</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Se incluirá en el correo al usuario."
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!busyId}>
              {busyId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
