import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { LugaresService } from './lugares.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GooglePlacesService } from './google-places.service.js';

describe('LugaresService', () => {
  let service: LugaresService;
  let prisma: any;
  let googlePlaces: any;

  const poi = {
    nombre: 'Museo X',
    ciudad: 'Mendoza',
    pais: 'Argentina',
    direccion: 'Calle 1',
    latitud: -32.9,
    longitud: -68.8,
    categoria: 'museo',
    rating: 4.5,
  };

  beforeEach(async () => {
    prisma = {
      lugar: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    googlePlaces = { buscarPorCategoria: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LugaresService,
        { provide: PrismaService, useValue: prisma },
        { provide: GooglePlacesService, useValue: googlePlaces },
      ],
    }).compile();
    service = module.get<LugaresService>(LugaresService);
  });

  describe('buscarYCachear', () => {
    it('crea el lugar si no existía, con los datos de Places', async () => {
      googlePlaces.buscarPorCategoria.mockResolvedValue([poi]);
      prisma.lugar.findFirst.mockResolvedValue(null);
      prisma.lugar.create.mockResolvedValue({ id_lugar: 1 });

      await service.buscarYCachear('Mendoza', { museo: 'museos' });

      expect(prisma.lugar.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: 'Museo X',
          rating: 4.5,
          categoria: 'museo',
          fuente_api: 'google_places',
        }),
      });
      expect(prisma.lugar.update).not.toHaveBeenCalled();
    });

    it('refresca el lugar existente con los datos de Places (no lo devuelve tal cual)', async () => {
      googlePlaces.buscarPorCategoria.mockResolvedValue([poi]);
      // Fila vieja creada por la IA: sin rating, categoría genérica.
      prisma.lugar.findFirst.mockResolvedValue({
        id_lugar: 7,
        nombre: 'Museo X',
        rating: null,
        fuente_api: 'gemini',
      });
      prisma.lugar.update.mockResolvedValue({ id_lugar: 7 });

      await service.buscarYCachear('Mendoza', { museo: 'museos' });

      expect(prisma.lugar.update).toHaveBeenCalledWith({
        where: { id_lugar: 7 },
        data: expect.objectContaining({
          rating: 4.5,
          categoria: 'museo',
          fuente_api: 'google_places',
        }),
      });
      expect(prisma.lugar.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarEnCache', () => {
    it('busca por nombre y acota por la ciudad del destino', async () => {
      prisma.lugar.findMany.mockResolvedValue([]);
      await service.buscarEnCache('muse', 'Mendoza, Argentina');

      const arg = prisma.lugar.findMany.mock.calls[0][0] as any;
      expect(arg.where.nombre).toEqual({ contains: 'muse', mode: 'insensitive' });
      // "Mendoza, Argentina" -> ciudad "Mendoza"
      expect(arg.where.ciudad).toEqual({ equals: 'Mendoza', mode: 'insensitive' });
      expect(arg.take).toBe(10);
    });

    it('sin destino no filtra por ciudad', async () => {
      prisma.lugar.findMany.mockResolvedValue([]);
      await service.buscarEnCache('muse');
      const arg = prisma.lugar.findMany.mock.calls[0][0] as any;
      expect(arg.where.ciudad).toBeUndefined();
    });
  });
});
