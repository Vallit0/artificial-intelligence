// ============================================
// Password hashing helper
// ============================================
//
// Centraliza bcrypt rounds. OWASP 2024 recomienda 10 como mínimo para
// bcrypt; 12 es paranoico y agrega ~250ms por hash en la VM actual, lo que
// satura el event loop bajo carga concurrente (carga masiva de usuarios,
// stress tests). 10 nos da ~60ms por hash sin degradar la seguridad.
//
// Las contraseñas viejas (hashes con rounds=12) siguen verificándose
// correctamente — bcrypt encodea el costo dentro del hash, así que la
// transición es transparente.

import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
