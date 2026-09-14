import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AlojamientoService } from './alojamiento.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService } from './booking.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { GooglePlacesService } from '../lugares/google-places.service.js';
import { GeminiService } from '../itinerarios/gemini.service.js';
import { PlanesService } from '../planes/planes.service.js';
import { LimitePlanException } from '../planes/limite-plan.exception.js';

describe('AlojamientoService', () => {
  let service: AlojamientoService;
  let prisma: any;
  let booking: any;
  let presupuestos: any;
  let googlePlaces: any;
  let gemini: any;
  let planes: any;

  // Un hotel como lo devuelve GooglePlacesService.buscarAlojamientosGoogle().
  const hotel = (id: string, rating: number | null) => ({
    id,
    nombre: `Hotel ${id}`,
    direccion: `Calle ${id}`,
    latitud: -32.88,
    longitud: -68.84,
    rating,
    userRatingCount: 100,
    websiteUri: `https://${id}.test`,
    googleMapsUri: `https://maps.test/${id}`,
    fotoUrl: '/api/lugares/foto?name=places%2Fx%2Fphotos%2Fy',
    fotos: ['/api/lugares/foto?name=places%2Fx%2Fphotos%2Fy'],
    priceLevel: null,
  });

  const viaje = {
    id_viaje: 5,
    id_usuario: 1,
    destino_principal: 'Mendoza',
    fechaInicio: new Date('2026-09-10'),
    fechaFin: new Date('2026-09-13'), // 3 noches
    cantidadPersonas: 2,
  };

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      opcionAlojamiento: { findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.perfilViajero = { findUnique: jest.fn() };
    prisma.perfilViajero.findUnique.mockResolvedValue(null);
    booking = { resolverDestino: jest.fn(), buscarHoteles: jest.fn() };
    presupuestos = { recalcularConTx: jest.fn() };
    // Por defecto Google no devuelve nada: así los casos de abajo ejercitan la
    // rama de Booking, que quedó como fallback.
    googlePlaces = {
      buscarAlojamientosGoogle: jest.fn(),
      buscarDetalleHotel: jest.fn(),
    };
    googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([]);
    // Sin ficha de Places por defecto: el enriquecimiento es opcional.
    googlePlaces.buscarDetalleHotel.mockResolvedValue(null);
    gemini = { sugerirAlojamientos: jest.fn() };
    gemini.sugerirAlojamientos.mockResolvedValue([]);
    planes = { verificar: jest.fn(), registrar: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlojamientoService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingService, useValue: booking },
        { provide: PresupuestosService, useValue: presupuestos },
        { provide: GooglePlacesService, useValue: googlePlaces },
        { provide: GeminiService, useValue: gemini },
        { provide: PlanesService, useValue: planes },
      ],
    }).compile();
    service = module.get<AlojamientoService>(AlojamientoService);
  });

  it('lanza Forbidden si el viaje es de otro usuario', async () => {
    prisma.viaje.findUnique.mockResolvedValue({ ...viaje, id_usuario: 999 });
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lanza BadRequest si no se puede resolver el destino', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    booking.resolverDestino.mockResolvedValue(null);
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('calcula precio por noche (total / noches) y rankea ascendente', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    booking.resolverDestino.mockResolvedValue({ destId: 'X', searchType: 'city' });
    booking.buscarHoteles.mockResolvedValue([
      { nombre: 'Caro', precioTotal: 600, rating: 9, latitud: null, longitud: null }, // 200/noche
      { nombre: 'Barato', precioTotal: 150, rating: 8, latitud: null, longitud: null }, // 50/noche
      { nombre: 'Base', precioTotal: 300, rating: 7, latitud: null, longitud: null }, // 100/noche
    ]);
    prisma.opcionAlojamiento.findMany.mockResolvedValue([]);

    let creados: any[] = [];
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        opcionAlojamiento: {
          deleteMany: jest.fn(),
          createMany: jest.fn((arg: any) => {
            creados = arg.data;
          }),
        },
      }),
    );

    await service.buscarYGuardar(1, 5);

    expect(creados.map((c) => c.precio_por_noche)).toEqual([50, 100, 200]);
    expect(creados[0].nombre).toBe('Barato');
  });

  it('pide una habitación doble cada dos personas', async () => {
    prisma.viaje.findUnique.mockResolvedValue({ ...viaje, cantidadPersonas: 5 });
    booking.resolverDestino.mockResolvedValue({ destId: 'X', searchType: 'city' });
    booking.buscarHoteles.mockResolvedValue([]);
    prisma.opcionAlojamiento.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({ opcionAlojamiento: { deleteMany: jest.fn(), createMany: jest.fn() } }),
    );

    // Sin hoteles el service corta con BadRequest (antes guardaba lista vacía),
    // pero lo que importa acá es con qué parámetros se pidió la búsqueda.
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(booking.buscarHoteles).toHaveBeenCalledWith(
      expect.objectContaining({ adultos: 5, habitaciones: 3 }),
    );
  });

  describe('rama de Google Places + Gemini', () => {
    // Devuelve lo que se persistió en createMany, que es lo que nos interesa.
    async function correrYCapturar() {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findMany.mockResolvedValue([]);
      let creados: any[] = [];
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          opcionAlojamiento: {
            deleteMany: jest.fn(),
            createMany: jest.fn((arg: any) => {
              creados = arg.data;
            }),
          },
        }),
      );
      await service.buscarYGuardar(1, 5);
      return creados;
    }

    it('pone primero los recomendados por la IA y completa el resto por rating', async () => {
      googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([
        hotel('a', 4.0),
        hotel('b', 4.9),
        hotel('c', 3.0),
        hotel('d', 4.5),
        hotel('e', 2.0),
        hotel('f', 1.0),
      ]);
      gemini.sugerirAlojamientos.mockResolvedValue([
        { id: 'c', razonRecomendacion: 'Céntrico' },
        { id: 'a', razonRecomendacion: 'Tranquilo' },
      ]);

      const creados = await correrYCapturar();

      // c y a porque los eligió la IA; después b/d/e por rating descendente.
      expect(creados.map((c) => c.nombre)).toEqual([
        'Hotel c',
        'Hotel a',
        'Hotel b',
        'Hotel d',
        'Hotel e',
      ]);
    });

    it('no inventa precios: la rama de Google guarda precio_por_noche en null', async () => {
      googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([
        hotel('a', 4.0),
        hotel('b', 4.9),
      ]);
      gemini.sugerirAlojamientos.mockResolvedValue([
        { id: 'a', razonRecomendacion: 'Tranquilo' },
      ]);

      const creados = await correrYCapturar();

      // Google Places no publica tarifas; antes se guardaba una estimación de
      // Gemini (y un fallback de 120) que terminaba sumando al presupuesto.
      expect(creados.map((c) => c.precio_por_noche)).toEqual([null, null]);
    });

    it('marca recomendadaIA sólo en los que la IA calificó', async () => {
      googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([
        hotel('a', 4.0),
        hotel('b', 4.9),
      ]);
      gemini.sugerirAlojamientos.mockResolvedValue([
        { id: 'a', razonRecomendacion: 'Tranquilo' },
      ]);

      const creados = await correrYCapturar();
      const meta = creados.map((c) => JSON.parse(c.url_referencia));

      expect(meta[0].recomendadaIA).toBe(true);
      expect(meta[0].razon).toBe('Tranquilo');
      // El que la IA no miró no lleva sello ni justificación inventada.
      expect(meta[1].recomendadaIA).toBe(false);
      expect(meta[1].razon).toBeNull();
    });

    it('guarda la metadata en url_referencia sin filtrar la API key', async () => {
      googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([hotel('a', 4.0)]);
      gemini.sugerirAlojamientos.mockResolvedValue([
        { id: 'a', razonRecomendacion: 'Céntrico' },
      ]);

      const creados = await correrYCapturar();
      const meta = JSON.parse(creados[0].url_referencia);

      expect(meta.razon).toBe('Céntrico');
      expect(meta.fotos).toEqual([
        '/api/lugares/foto?name=places%2Fx%2Fphotos%2Fy',
      ]);
      // Las fotos se sirven por nuestro backend; la key nunca llega al browser.
      expect(creados[0].url_referencia).not.toContain('key=');
    });

    it('sólo se usa cuando Booking no devolvió nada', async () => {
      // Booking es la fuente principal porque es la única con tarifas reales;
      // esta rama existe para destinos que Booking no cubre.
      googlePlaces.buscarAlojamientosGoogle.mockResolvedValue([hotel('a', 4.0)]);

      const creados = await correrYCapturar();

      expect(booking.resolverDestino).toHaveBeenCalled();
      expect(creados[0].precio_por_noche).toBeNull();
    });
  });

  describe('rama de Booking (principal)', () => {
    const hotelBooking = (nombre: string, precioTotal: number) => ({
      nombre,
      precioTotal,
      rating: 8.5,
      latitud: 48.8333,
      longitud: 2.3869,
    });

    async function correrConBooking(hoteles: any[]) {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findMany.mockResolvedValue([]);
      booking.resolverDestino.mockResolvedValue({ destId: 'X', searchType: 'city' });
      booking.buscarHoteles.mockResolvedValue(hoteles);
      let creados: any[] = [];
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({
          opcionAlojamiento: {
            deleteMany: jest.fn(),
            createMany: jest.fn((arg: any) => {
              creados = arg.data;
            }),
          },
        }),
      );
      await service.buscarYGuardar(1, 5);
      return creados;
    }

    it('guarda el precio real de Booking, prorrateado por noche', async () => {
      // 3 noches (10/09 -> 13/09): 150 de estadía = 50 por noche.
      const creados = await correrConBooking([hotelBooking('Ibis Bercy', 150)]);

      expect(creados[0].precio_por_noche).toBe(50);
      const meta = JSON.parse(creados[0].url_referencia);
      expect(meta.precioReal).toBe(true);
      expect(meta.fuentePrecio).toBe('booking');
    });

    it('no consulta Google Places como fuente de hoteles', async () => {
      await correrConBooking([hotelBooking('Ibis Bercy', 150)]);

      // Places sólo enriquece hotel por hotel; no es la lista de candidatos.
      expect(googlePlaces.buscarAlojamientosGoogle).not.toHaveBeenCalled();
      // Se le pasan las coordenadas de Booking como sesgo: sin eso Google
      // devuelve cualquier propiedad de la ciudad para nombres genéricos.
      expect(googlePlaces.buscarDetalleHotel).toHaveBeenCalledWith(
        'Ibis Bercy',
        'Mendoza',
        { latitud: 48.8333, longitud: 2.3869 },
      );
    });

    it('adopta fotos y web de Places cuando es el mismo hotel', async () => {
      googlePlaces.buscarDetalleHotel.mockResolvedValue({
        ...hotel('g', 4.4),
        nombre: 'ibis budget Paris Porte de Bercy',
        latitud: 48.8334,
        longitud: 2.387,
      });

      const creados = await correrConBooking([hotelBooking('Ibis Bercy', 150)]);
      const meta = JSON.parse(creados[0].url_referencia);

      expect(meta.fotos.length).toBeGreaterThan(0);
      expect(creados[0].rating).toBe(4.4);
    });

    it('descarta la ficha de Places si es otro hotel', async () => {
      // Misma cadena, otro edificio a ~2 km: pegarle estas fotos sería mentir.
      googlePlaces.buscarDetalleHotel.mockResolvedValue({
        ...hotel('g', 4.4),
        nombre: 'ibis budget Paris La Villette',
        latitud: 48.8899,
        longitud: 2.3889,
      });

      const creados = await correrConBooking([hotelBooking('Ibis Bercy', 150)]);
      const meta = JSON.parse(creados[0].url_referencia);

      expect(meta.fotos).toEqual([]);
      expect(meta.fotoUrl).toBeNull();
      // Se conserva el precio real igual: lo que se descarta es sólo la ficha.
      expect(creados[0].precio_por_noche).toBe(50);
    });

    it('le pasa los precios reales a la IA para que respete el presupuesto', async () => {
      await correrConBooking([hotelBooking('Ibis Bercy', 150)]);

      expect(gemini.sugerirAlojamientos).toHaveBeenCalledWith(
        expect.objectContaining({
          noches: 3,
          hotelesDisponibles: [expect.objectContaining({ precioPorNoche: 50 })],
        }),
      );
    });
  });

  describe('plan', () => {
    it('si el plan no permite buscar alojamiento, no le pega a Booking ni a Places', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      planes.verificar.mockRejectedValue(
        new LimitePlanException({
          message: 'Tu plan Gratis incluye 1 búsqueda de alojamiento por viaje.',
          accion: 'BUSCAR_ALOJAMIENTO',
          planActual: 'GRATIS',
          planSugerido: 'BASE',
          limite: 1,
          usado: 1,
          renuevaEl: null,
        }),
      );

      await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
        LimitePlanException,
      );
      expect(planes.verificar).toHaveBeenCalledWith(1, 'BUSCAR_ALOJAMIENTO', 5);
      expect(booking.resolverDestino).not.toHaveBeenCalled();
      expect(googlePlaces.buscarAlojamientosGoogle).not.toHaveBeenCalled();
    });

    it('registra el consumo dentro de la transacción al guardar opciones', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findMany.mockResolvedValue([]);
      booking.resolverDestino.mockResolvedValue({ destId: 'X', searchType: 'city' });
      booking.buscarHoteles.mockResolvedValue([
        { nombre: 'Ibis', precioTotal: 150, rating: 8, latitud: null, longitud: null },
      ]);
      const tx = {
        opcionAlojamiento: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.buscarYGuardar(1, 5);

      expect(planes.registrar).toHaveBeenCalledWith(1, 'BUSCAR_ALOJAMIENTO', 5, tx);
    });

    it('si no encuentra ningún alojamiento, no registra consumo', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      booking.resolverDestino.mockResolvedValue(null);

      await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(planes.registrar).not.toHaveBeenCalled();
    });
  });

  describe('seleccionar', () => {
    it('deselecciona las demás opciones del viaje y recalcula el presupuesto', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findUnique.mockResolvedValue({
        id_alojamiento: 7,
        id_viaje: 5,
      });
      prisma.opcionAlojamiento.findMany.mockResolvedValue([]);

      const tx = {
        opcionAlojamiento: { update: jest.fn(), updateMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.seleccionar(1, 5, 7, true);

      expect(tx.opcionAlojamiento.updateMany).toHaveBeenCalledWith({
        where: { id_viaje: 5, seleccionado: true },
        data: { seleccionado: false },
      });
      expect(tx.opcionAlojamiento.update).toHaveBeenCalledWith({
        where: { id_alojamiento: 7 },
        data: { seleccionado: true },
      });
      expect(presupuestos.recalcularConTx).toHaveBeenCalledWith(tx, 5);
    });

    it('lanza NotFound si la opción es de otro viaje', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findUnique.mockResolvedValue({
        id_alojamiento: 7,
        id_viaje: 99,
      });
      await expect(service.seleccionar(1, 5, 7, true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
