import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { IgnavService } from './ignav.service.js';

/** Respuesta OK de fetch con un body JSON cualquiera. */
function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function conEstado(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as Response;
}

describe('IgnavService', () => {
  let service: IgnavService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.IGNAV_API_KEY = 'test-key';
    process.env.IGNAV_MOCK = 'false';
    process.env.RAPIDAPI_MOCK = 'false';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new IgnavService();
  });

  afterEach(() => {
    delete process.env.IGNAV_MOCK;
  });

  describe('resolverAeropuerto', () => {
    it('sube el aeropuerto al área metropolitana: Buenos Aires busca por BUE, no por AEP', async () => {
      // Es el caso que importa: el buscador devuelve Aeroparque primero, y
      // buscar sólo AEP se pierde todos los internacionales, que salen de Ezeiza.
      fetchMock.mockResolvedValue(
        ok([
          {
            code: 'AEP',
            name: 'Jorge Newbery',
            city: 'Buenos Aires',
            country: 'AR',
          },
        ]),
      );

      expect(
        await service.resolverAeropuerto('Buenos Aires, Argentina'),
      ).toEqual({
        iata: 'BUE',
        ciudad: 'Buenos Aires',
      });
    });

    it('deja el IATA tal cual en las ciudades de un solo aeropuerto', async () => {
      fetchMock.mockResolvedValue(
        ok([
          {
            code: 'MDZ',
            name: 'El Plumerillo',
            city: 'Mendoza',
            country: 'AR',
          },
        ]),
      );

      expect(await service.resolverAeropuerto('Mendoza, Argentina')).toEqual({
        iata: 'MDZ',
        ciudad: 'Mendoza',
      });
    });

    it('descarta el sufijo de país antes de consultar', async () => {
      fetchMock.mockResolvedValue(
        ok([{ code: 'MDZ', name: '', city: 'Mendoza', country: 'AR' }]),
      );

      await service.resolverAeropuerto('Mendoza, Argentina');

      const url = fetchMock.mock.calls[0][0] as URL;
      expect(url.searchParams.get('q')).toBe('Mendoza');
    });

    it('cachea el resultado: la segunda consulta de la misma ciudad no gasta un request', async () => {
      fetchMock.mockResolvedValue(
        ok([{ code: 'MDZ', name: '', city: 'Mendoza', country: 'AR' }]),
      );

      await service.resolverAeropuerto('Mendoza');
      await service.resolverAeropuerto('mendoza');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('cachea también el "no encontrado", que cuesta lo mismo que un acierto', async () => {
      fetchMock.mockResolvedValue(ok([]));

      expect(await service.resolverAeropuerto('Ciudad Inventada')).toBeNull();
      expect(await service.resolverAeropuerto('Ciudad Inventada')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sin crédito (402) corta con un error explícito en vez de degradar a null', async () => {
      fetchMock.mockResolvedValue(conEstado(402));

      await expect(service.resolverAeropuerto('Mendoza')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('buscarVuelos', () => {
    const origen = { iata: 'BUE', ciudad: 'Buenos Aires' };
    const destino = { iata: 'MDZ', ciudad: 'Mendoza' };

    const itinerario = (segmentos: number) => ({
      price: { amount: 130, currency: 'USD', status: 'verified' },
      outbound: {
        carrier: 'JetSMART',
        duration_minutes: 119,
        segments: Array.from({ length: segmentos }, (_, i) => ({
          departure_airport: i === 0 ? 'AEP' : 'COR',
          departure_time_local: '2026-10-25T06:10:00',
          arrival_airport: i === segmentos - 1 ? 'MDZ' : 'COR',
          arrival_time_local: '2026-10-25T08:09:00',
          duration_minutes: 119,
        })),
      },
      ignav_id: 'abc',
    });

    it('mapea un itinerario directo', async () => {
      fetchMock.mockResolvedValue(ok({ itineraries: [itinerario(1)] }));

      const [v] = await service.buscarVuelos({
        origen,
        destino,
        fecha: '2026-10-25',
        adultos: 2,
      });

      expect(v).toEqual({
        origen: 'Buenos Aires',
        destino: 'Mendoza',
        fecha: '2026-10-25T06:10:00',
        llegada: '2026-10-25T08:09:00',
        aerolinea: 'JetSMART',
        precio: 130,
        duracionMinutos: 119,
        escalas: 0,
      });
    });

    it('cuenta las escalas como segmentos menos uno', async () => {
      fetchMock.mockResolvedValue(ok({ itineraries: [itinerario(3)] }));

      const [v] = await service.buscarVuelos({
        origen,
        destino,
        fecha: '2026-10-25',
        adultos: 1,
      });

      expect(v.escalas).toBe(2);
    });

    it('manda los pasajeros y el market en el body', async () => {
      fetchMock.mockResolvedValue(ok({ itineraries: [] }));

      await service.buscarVuelos({
        origen,
        destino,
        fecha: '2026-10-25',
        adultos: 3,
      });

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({
        origin: 'BUE',
        destination: 'MDZ',
        departure_date: '2026-10-25',
        adults: 3,
        market: 'US',
      });
    });

    it('reintenta ante un 424 del proveedor de arriba', async () => {
      fetchMock
        .mockResolvedValueOnce(conEstado(424))
        .mockResolvedValueOnce(ok({ itineraries: [itinerario(1)] }));

      const vuelos = await service.buscarVuelos({
        origen,
        destino,
        fecha: '2026-10-25',
        adultos: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(vuelos).toHaveLength(1);
    });

    it('un 400 no se reintenta: reintentar no lo va a arreglar', async () => {
      fetchMock.mockResolvedValue(conEstado(400));

      expect(
        await service.buscarVuelos({
          origen,
          destino,
          fecha: '2026-10-25',
          adultos: 1,
        }),
      ).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('el tope de gasto (429) corta con error, no con lista vacía', async () => {
      fetchMock.mockResolvedValue(conEstado(429));

      await expect(
        service.buscarVuelos({
          origen,
          destino,
          fecha: '2026-10-25',
          adultos: 1,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('modo mock', () => {
    it('con IGNAV_MOCK=true no le pega a la API', async () => {
      process.env.IGNAV_MOCK = 'true';

      const aeropuerto = await service.resolverAeropuerto('Mendoza');
      const vuelos = await service.buscarVuelos({
        origen: { iata: 'MCK', ciudad: 'Buenos Aires' },
        destino: { iata: 'MCK', ciudad: 'Mendoza' },
        fecha: '2026-10-25',
        adultos: 1,
      });

      expect(aeropuerto).toEqual({ iata: 'MCK', ciudad: 'Mendoza' });
      expect(vuelos.length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('se cae a RAPIDAPI_MOCK para no romper los .env que ya existen', async () => {
      delete process.env.IGNAV_MOCK;
      process.env.RAPIDAPI_MOCK = 'true';

      await service.resolverAeropuerto('Mendoza');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
