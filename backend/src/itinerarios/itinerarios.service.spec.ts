import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { ItinerariosService } from './itinerarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeminiService } from './gemini.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { LugaresService } from '../lugares/lugares.service.js';
import { GeocodingService } from '../lugares/geocoding.service.js';

describe('ItinerariosService', () => {
  let service: ItinerariosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      itinerario: { findUnique: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItinerariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeminiService, useValue: { generarItinerario: jest.fn() } },
        { provide: PresupuestosService, useValue: { recalcularConTx: jest.fn() } },
        { provide: LugaresService, useValue: { buscarYCachear: jest.fn() } },
        { provide: GeocodingService, useValue: { geocodificar: jest.fn() } },
      ],
    }).compile();
    service = module.get<ItinerariosService>(ItinerariosService);
  });

  describe('getItinerario (guards)', () => {
    it('lanza NotFound si el viaje no existe', async () => {
      prisma.viaje.findUnique.mockResolvedValue(null);
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza Forbidden si el viaje es de otro usuario (IDOR)', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 2 });
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lanza NotFound si el viaje aún no tiene itinerario', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue(null);
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('agregarActividad (validación)', () => {
    it('lanza BadRequest si no se envía id_lugar ni nombre_lugar', async () => {
      // el viaje es del usuario y ya tiene itinerario -> pasa los guards
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue({ id_itinerario: 1 });
      await expect(
        service.agregarActividad(1, 5, 10, { tipo_actividad: 'visita' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
