import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Cita, CitaInput, CitaUser } from "@/hooks/useCitas";
import { Loader2 } from "lucide-react";

const DIRECTORS = [
  "Wendy Arteaga",
  "Martha De Leon",
  "Ana Gonzalez",
  "Carlos Mendez",
  "Roberto Diaz",
  "Patricia Ruiz",
  "Fernando Lopez",
  "Maria Torres",
];

const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
];

interface CitaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cita?: Cita | null;
  users: CitaUser[];
  onSubmit: (data: CitaInput) => void;
  isSubmitting: boolean;
}

export default function CitaFormDialog({
  open,
  onOpenChange,
  cita,
  users,
  onSubmit,
  isSubmitting,
}: CitaFormDialogProps) {
  const [form, setForm] = useState({
    director: "",
    asesorId: "",
    asesorName: "",
    cliente: "",
    municipio: "",
    ciudad: "",
    zona: "",
    fecha: "",
    horaInicio: "09:00",
    tipo: "presencial" as const,
    prioridad: "media" as const,
    linkSala: "",
    notas: "",
  });

  useEffect(() => {
    if (cita) {
      setForm({
        director: cita.director,
        asesorId: cita.asesorId,
        asesorName: cita.asesorName,
        cliente: cita.cliente,
        municipio: cita.municipio,
        ciudad: cita.ciudad,
        zona: cita.zona,
        fecha: cita.fecha.split("T")[0],
        horaInicio: cita.horaInicio,
        tipo: cita.tipo,
        prioridad: cita.prioridad,
        linkSala: cita.linkSala || "",
        notas: cita.notas || "",
      });
    } else {
      setForm({
        director: "",
        asesorId: "",
        asesorName: "",
        cliente: "",
        municipio: "",
        ciudad: "",
        zona: "",
        fecha: "",
        horaInicio: "09:00",
        tipo: "presencial",
        prioridad: "media",
        linkSala: "",
        notas: "",
      });
    }
  }, [cita, open]);

  const handleAsesorChange = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    setForm((f) => ({
      ...f,
      asesorId: userId,
      asesorName: u?.fullName || u?.email || "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      linkSala: form.linkSala || undefined,
      notas: form.notas || undefined,
    });
  };

  const isValid =
    form.director &&
    form.asesorId &&
    form.cliente &&
    form.municipio &&
    form.ciudad &&
    form.zona &&
    form.fecha &&
    form.horaInicio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cita ? "Editar Cita" : "Nueva Cita"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Director */}
          <div className="space-y-1.5">
            <Label>Director *</Label>
            <Select value={form.director} onValueChange={(v) => setForm((f) => ({ ...f, director: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar director" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTORS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asesor */}
          <div className="space-y-1.5">
            <Label>Asesor *</Label>
            <Select value={form.asesorId} onValueChange={handleAsesorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar asesor" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input
              value={form.cliente}
              onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
              placeholder="Nombre del cliente"
            />
          </div>

          {/* Ubicacion row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Municipio *</Label>
              <Input
                value={form.municipio}
                onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad *</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Zona *</Label>
              <Input
                value={form.zona}
                onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
              />
            </div>
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora inicio *</Label>
              <Select value={form.horaInicio} onValueChange={(v) => setForm((f) => ({ ...f, horaInicio: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORAS.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v: any) => setForm((f) => ({ ...f, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="telefonica">Telefonica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                value={form.prioridad}
                onValueChange={(v: any) => setForm((f) => ({ ...f, prioridad: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Link sala - solo virtual */}
          {form.tipo === "virtual" && (
            <div className="space-y-1.5">
              <Label>Link de sala</Label>
              <Input
                value={form.linkSala}
                onChange={(e) => setForm((f) => ({ ...f, linkSala: e.target.value }))}
                placeholder="https://meet.google.com/..."
              />
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {cita ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
