import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Cita {
  id: string;
  director: string;
  asesorId: string;
  asesorName: string;
  cliente: string;
  municipio: string;
  ciudad: string;
  zona: string;
  fecha: string;
  horaInicio: string;
  tipo: "presencial" | "virtual" | "telefonica";
  prioridad: "alta" | "media" | "baja";
  linkSala?: string;
  notas?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  asesor: { id: string; email: string; fullName?: string };
  creator: { id: string; email: string; fullName?: string };
}

export interface CitaInput {
  director: string;
  asesorId: string;
  asesorName: string;
  cliente: string;
  municipio: string;
  ciudad: string;
  zona: string;
  fecha: string;
  horaInicio: string;
  tipo?: "presencial" | "virtual" | "telefonica";
  prioridad?: "alta" | "media" | "baja";
  linkSala?: string;
  notas?: string;
}

export interface CitaUser {
  id: string;
  email: string;
  fullName?: string;
}

export function useCitas(
  start: string,
  end: string,
  filters?: { director?: string; prioridad?: string }
) {
  return useQuery<Cita[]>({
    queryKey: ["citas", start, end, filters?.director, filters?.prioridad],
    queryFn: () => {
      const params = new URLSearchParams({ start, end });
      if (filters?.director) params.set("director", filters.director);
      if (filters?.prioridad) params.set("prioridad", filters.prioridad);
      return api.get<Cita[]>(`/api/citas?${params.toString()}`);
    },
    enabled: !!start && !!end,
  });
}

export function useCitaUsers() {
  return useQuery<CitaUser[]>({
    queryKey: ["cita-users"],
    queryFn: () => api.get<CitaUser[]>("/api/citas/users"),
  });
}

export function useCitaDirectors() {
  return useQuery<string[]>({
    queryKey: ["cita-directors"],
    queryFn: () => api.get<string[]>("/api/citas/directors"),
  });
}

export function useCreateCita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CitaInput) => api.post<Cita>("/api/citas", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citas"] }),
  });
}

export function useUpdateCita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: CitaInput & { id: string }) =>
      api.patch<Cita>(`/api/citas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citas"] }),
  });
}

export function useDeleteCita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/citas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citas"] }),
  });
}
