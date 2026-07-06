// Lista de países soportados por la plataforma. Centralizada aquí para que el
// selector de país sea consistente en todo el sistema (Sedes, Divisiones,
// registro de usuarios, etc.). El valor almacenado es el código ISO corto
// ("GT", "MX"), que es lo que persiste la columna `Sede.country`.
export interface Country {
  code: string; // ISO 3166-1 alpha-2 — lo que se guarda en BD
  name: string; // Nombre para mostrar en la UI
}

export const COUNTRIES: Country[] = [
  { code: "GT", name: "Guatemala" },
  { code: "MX", name: "México" },
];

// País por defecto al crear una sede nueva.
export const DEFAULT_COUNTRY_CODE = "GT";

// Devuelve el nombre para mostrar dado un código; si no se reconoce, regresa
// el código tal cual (soporta datos legacy con valores fuera de la lista).
export const countryLabel = (code: string | null | undefined): string => {
  if (!code) return "";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
};
