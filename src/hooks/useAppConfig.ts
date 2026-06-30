import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

// Configuración global de la plataforma. Refleja el modelo AppConfig del
// backend. La lectura (GET /api/config) está disponible para cualquier usuario
// autenticado; la escritura (PUT /api/admin/config) es admin-only.
export interface AppConfig {
  id: string;
  callDurationProspeccionSec: number;
  callDurationObjecionesSec: number;
  passThresholdProspeccion: number;
  passThresholdObjeciones: number;
  certificateInstructorName: string | null;
  certificateDirectorName: string | null;
  certificateCourseName: string | null;
  certificateLevel1InstructorName: string | null;
  certificateLevel1DirectorName: string | null;
  certificateLevel1CourseName: string | null;
  updatedAt: string;
}

// Defaults que replican los valores históricos fijos en código. Se usan como
// fallback mientras la config carga o si el fetch falla.
export const APP_CONFIG_DEFAULTS = {
  callDurationProspeccionSec: 300,
  callDurationObjecionesSec: 600,
  passThresholdProspeccion: 75,
  passThresholdObjeciones: 80,
} as const;

export type AppConfigPatch = Partial<
  Pick<
    AppConfig,
    | "callDurationProspeccionSec"
    | "callDurationObjecionesSec"
    | "passThresholdProspeccion"
    | "passThresholdObjeciones"
    | "certificateInstructorName"
    | "certificateDirectorName"
    | "certificateCourseName"
    | "certificateLevel1InstructorName"
    | "certificateLevel1DirectorName"
    | "certificateLevel1CourseName"
  >
>;

export const usePlatformConfig = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<AppConfig>("/api/config");
      setConfig(data ?? null);
    } catch (err) {
      console.error("Error fetching app config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Escritura admin-only. Devuelve true/false; refresca la config local al ok.
  const updateConfig = useCallback(
    async (patch: AppConfigPatch): Promise<boolean> => {
      try {
        const res = await api.put<{ success: boolean; config: AppConfig }>(
          "/api/admin/config",
          patch,
        );
        if (res?.config) setConfig(res.config);
        return true;
      } catch (err) {
        console.error("Error updating app config:", err);
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, isLoading, updateConfig, refetch: fetchConfig };
};
