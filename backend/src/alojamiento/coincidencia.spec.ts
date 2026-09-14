import { describe, it, expect } from '@jest/globals';
import {
  distanciaMetros,
  esElMismoHotel,
  similitudNombre,
  tokenizarNombre,
} from './coincidencia.js';

describe('coincidencia de hoteles', () => {
  describe('tokenizarNombre', () => {
    it('saca acentos, puntuación y palabras genéricas', () => {
      expect(tokenizarNombre('Hôtel F1 Paris Porte de Châtillon')).toEqual([
        'f1',
        'paris',
        'porte',
        'chatillon',
      ]);
    });

    it('deja vacío un nombre que es puro genérico', () => {
      expect(tokenizarNombre('The Hotel')).toEqual([]);
    });
  });

  describe('similitudNombre', () => {
    it('reconoce el mismo hotel nombrado distinto por cada API', () => {
      // Google lo llama así y Booking lo abrevia.
      expect(
        similitudNombre('Ibis Budget Bercy', 'ibis budget Paris Porte de Bercy'),
      ).toBe(1);
    });

    it('no confunde dos hoteles que sólo comparten palabras genéricas', () => {
      expect(similitudNombre('Hotel Roma', 'Hotel Madrid')).toBe(0);
    });

    it('devuelve 0 si alguno no tiene palabras propias', () => {
      expect(similitudNombre('The Hotel', 'Hotel Adriatic')).toBe(0);
    });
  });

  describe('distanciaMetros', () => {
    it('mide bien una distancia corta conocida', () => {
      // Dos puntos del centro de Mendoza separados por ~1.2 km.
      const m = distanciaMetros(-32.8895, -68.8458, -32.8895, -68.8329);
      expect(m).toBeGreaterThan(1000);
      expect(m).toBeLessThan(1400);
    });

    it('da 0 para el mismo punto', () => {
      expect(distanciaMetros(-34.6, -58.4, -34.6, -58.4)).toBe(0);
    });
  });

  describe('esElMismoHotel', () => {
    const booking = { nombre: 'Ibis Budget Bercy', latitud: 48.8333, longitud: 2.3869 };

    it('acepta por cercanía aunque el nombre no sea idéntico', () => {
      expect(
        esElMismoHotel(booking, {
          nombre: 'ibis budget Paris Porte de Bercy',
          latitud: 48.8334,
          longitud: 2.387,
        }),
      ).toBe(true);
    });

    it('rechaza un hotel distinto que está lejos', () => {
      expect(
        esElMismoHotel(booking, {
          nombre: 'Hotel Adriatic',
          latitud: 41.9028,
          longitud: 12.4964,
        }),
      ).toBe(false);
    });

    it('rechaza otro hotel de la misma cadena a 2 km', () => {
      // El riesgo real: mismas palabras de marca, edificio distinto.
      expect(
        esElMismoHotel(booking, {
          nombre: 'ibis budget Paris La Villette',
          latitud: 48.8899,
          longitud: 2.3889,
        }),
      ).toBe(false);
    });

    it('acepta por nombre exacto cuando una coordenada está mal cargada', () => {
      expect(
        esElMismoHotel(booking, {
          nombre: 'Ibis Budget Bercy',
          latitud: 0,
          longitud: 0,
        }),
      ).toBe(true);
    });

    it('sin coordenadas exige que compartan todas las palabras propias', () => {
      expect(
        esElMismoHotel(
          { nombre: 'Hotel Adriatic', latitud: null, longitud: null },
          { nombre: 'Adriatic', latitud: null, longitud: null },
        ),
      ).toBe(true);

      expect(
        esElMismoHotel(
          { nombre: 'Hotel Adriatic', latitud: null, longitud: null },
          { nombre: 'Hotel Cristoforo Colombo', latitud: null, longitud: null },
        ),
      ).toBe(false);
    });
  });
});
