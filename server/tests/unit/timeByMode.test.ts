// ============================================
// aggregateTimeByMode — desglose de tiempo por modo (función pura)
// ============================================
//
// Verifica la taxonomía: Prospección es sub-modo de Role-Play Cliente (suma a la
// familia Cliente = métrica Nivel 1), exámenes y "sin clasificar" se separan.

import { describe, it, expect } from 'vitest';
import { aggregateTimeByMode } from '../../src/services/analytics.service.js';

describe('aggregateTimeByMode', () => {
  it('suma cliente + prospección en la familia Role-Play Cliente (Nivel 1)', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 60, practiceMode: 'cliente', examType: null },
      { durationSeconds: 30, practiceMode: 'cliente_prospeccion', examType: null },
    ]);

    expect(r.roleplayClienteSeconds).toBe(90);
    expect(r.clienteOtrosSeconds).toBe(60);
    expect(r.prospeccionSeconds).toBe(30);
    expect(r.totalSeconds).toBe(90);
  });

  it('separa objeciones, asesor y coach', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 20, practiceMode: 'objeciones', examType: null },
      { durationSeconds: 10, practiceMode: 'asesor', examType: null },
      { durationSeconds: 5, practiceMode: 'coach', examType: null },
    ]);

    expect(r.roleplayObjecionesSeconds).toBe(20);
    expect(r.roleplayAsesorSeconds).toBe(10);
    expect(r.coachSeconds).toBe(5);
    expect(r.roleplayClienteSeconds).toBe(0);
  });

  it('clasifica exámenes por examType, no como práctica', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 40, practiceMode: null, examType: 'prospeccion' },
      { durationSeconds: 50, practiceMode: null, examType: 'objeciones' },
    ]);

    expect(r.examenProspeccionSeconds).toBe(40);
    expect(r.examenObjecionesSeconds).toBe(50);
    expect(r.roleplayClienteSeconds).toBe(0);
    expect(r.roleplayObjecionesSeconds).toBe(0);
  });

  it('cuenta sesiones sin modo ni examen como "sin clasificar"', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 15, practiceMode: null, examType: null },
    ]);

    expect(r.sinClasificarSeconds).toBe(15);
    expect(r.totalSeconds).toBe(15);
  });

  it('practiceMode tiene precedencia sobre examType', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 12, practiceMode: 'objeciones', examType: 'objeciones' },
    ]);

    expect(r.roleplayObjecionesSeconds).toBe(12);
    expect(r.examenObjecionesSeconds).toBe(0);
  });

  it('agrega un mix completo con total correcto', () => {
    const r = aggregateTimeByMode([
      { durationSeconds: 60, practiceMode: 'cliente', examType: null },
      { durationSeconds: 30, practiceMode: 'cliente_prospeccion', examType: null },
      { durationSeconds: 20, practiceMode: 'objeciones', examType: null },
      { durationSeconds: 10, practiceMode: 'asesor', examType: null },
      { durationSeconds: 5, practiceMode: 'coach', examType: null },
      { durationSeconds: 40, practiceMode: null, examType: 'prospeccion' },
      { durationSeconds: 50, practiceMode: null, examType: 'objeciones' },
      { durationSeconds: 15, practiceMode: null, examType: null },
    ]);

    expect(r.roleplayClienteSeconds).toBe(90);
    expect(r.totalSeconds).toBe(230);
  });

  it('devuelve ceros para una lista vacía', () => {
    const r = aggregateTimeByMode([]);
    expect(r.totalSeconds).toBe(0);
    expect(r.roleplayClienteSeconds).toBe(0);
    expect(r.sinClasificarSeconds).toBe(0);
  });
});
