import { describe, it, expect } from '@jest/globals';
import { periodoVigente, sumarMesesAnclado } from './periodo.js';

/** Fecha UTC con el mes en base 1, para que los tests se lean como calendario. */
const utc = (anio: number, mes: number, dia: number, hora = 0, minuto = 0) =>
  new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));

describe('periodo', () => {
  describe('sumarMesesAnclado', () => {
    it('conserva el día cuando el mes lo tiene', () => {
      expect(sumarMesesAnclado(utc(2026, 8, 13), 1)).toEqual(utc(2026, 9, 13));
    });

    it('usa el último día del mes si no existe, y vuelve al día original después', () => {
      const ancla = utc(2026, 1, 31);
      expect(sumarMesesAnclado(ancla, 1)).toEqual(utc(2026, 2, 28));
      expect(sumarMesesAnclado(ancla, 2)).toEqual(utc(2026, 3, 31));
      expect(sumarMesesAnclado(ancla, 3)).toEqual(utc(2026, 4, 30));
    });

    it('respeta los años bisiestos', () => {
      expect(sumarMesesAnclado(utc(2028, 1, 31), 1)).toEqual(utc(2028, 2, 29));
    });

    it('cruza el cambio de año', () => {
      expect(sumarMesesAnclado(utc(2026, 12, 15), 1)).toEqual(utc(2027, 1, 15));
      expect(sumarMesesAnclado(utc(2026, 1, 31), 12)).toEqual(utc(2027, 1, 31));
    });

    it('conserva la hora del ancla', () => {
      expect(sumarMesesAnclado(utc(2026, 8, 13, 22, 30), 1)).toEqual(
        utc(2026, 9, 13, 22, 30),
      );
    });
  });

  describe('periodoVigente', () => {
    it('pagó el 13/08: el período va del 13/08 al 13/09', () => {
      expect(periodoVigente(utc(2026, 8, 13), utc(2026, 8, 20))).toEqual({
        desde: utc(2026, 8, 13),
        hasta: utc(2026, 9, 13),
      });
    });

    it('pasado el primer mes, el período siguiente va del 13/09 al 13/10', () => {
      expect(periodoVigente(utc(2026, 8, 13), utc(2026, 9, 20))).toEqual({
        desde: utc(2026, 9, 13),
        hasta: utc(2026, 10, 13),
      });
    });

    it('con ancla 31/01, febrero termina el 28 y marzo vuelve al 31', () => {
      const ancla = utc(2026, 1, 31);
      expect(periodoVigente(ancla, utc(2026, 2, 10))).toEqual({
        desde: utc(2026, 1, 31),
        hasta: utc(2026, 2, 28),
      });
      expect(periodoVigente(ancla, utc(2026, 3, 1))).toEqual({
        desde: utc(2026, 2, 28),
        hasta: utc(2026, 3, 31),
      });
    });

    it('el instante exacto del vencimiento ya pertenece al período siguiente', () => {
      expect(periodoVigente(utc(2026, 8, 13), utc(2026, 9, 13))).toEqual({
        desde: utc(2026, 9, 13),
        hasta: utc(2026, 10, 13),
      });
    });

    it('un minuto antes del vencimiento sigue en el período actual', () => {
      expect(
        periodoVigente(utc(2026, 8, 13), utc(2026, 9, 12, 23, 59)).hasta,
      ).toEqual(utc(2026, 9, 13));
    });

    it('si el día ancla todavía no llegó este mes, sigue en el período anterior', () => {
      // Ancla el 20, hoy es 5: el mes de calendario cambió pero el período no.
      expect(periodoVigente(utc(2026, 8, 20), utc(2026, 10, 5))).toEqual({
        desde: utc(2026, 9, 20),
        hasta: utc(2026, 10, 20),
      });
    });

    it('funciona muchos meses después del ancla', () => {
      expect(periodoVigente(utc(2024, 1, 31), utc(2026, 9, 14))).toEqual({
        desde: utc(2026, 8, 31),
        hasta: utc(2026, 9, 30),
      });
    });
  });
});
