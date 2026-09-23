import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * E2E del flujo principal contra la base REAL (Supabase), con Gemini/Google
 * Places reales y vuelos/alojamiento mockeados (RAPIDAPI_MOCK). Al final borra
 * la cuenta creada para no dejar datos de prueba.
 */
describe('Flujo principal (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let token: string;
  let idViaje: number;
  let prisma: PrismaService;

  const email = `e2e_${Date.now()}@test.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    process.env.RAPIDAPI_MOCK = 'true'; // no gastar cuota de RapidAPI en los tests

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Misma config que main.ts para que validación y prefijo se comporten igual
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
    http = app.getHttpServer();
    prisma = moduleFixture.get(PrismaService);
  });

  // Timeout propio: borrar la cuenta cancela antes la suscripción y después borra
  // en cascada el viaje con itinerario, y eso supera los 5 s que Jest da por
  // defecto a un hook. Si se corta, app.close() no llega a correr.
  afterAll(async () => {
    // Cleanup: borrar la cuenta (cascade) si quedó creada.
    if (token) {
      await request(http)
        .delete('/api/usuarios/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password })
        .catch(() => undefined);
    }
    await app.close();
  }, 60_000);

  it('registro -> devuelve JWT', async () => {
    const res = await request(http)
      .post('/api/auth/register')
      .send({ nombre: 'E2E', apellido: 'Test', email, password })
      .expect(201);
    expect(res.body.access_token).toEqual(expect.any(String));
    token = res.body.access_token;
  });

  it('login -> devuelve JWT', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.access_token).toEqual(expect.any(String));
    token = res.body.access_token;
  });

  it('rechaza acceso sin token (401)', async () => {
    await request(http).get('/api/usuarios/me').expect(401);
  });

  it('crear viaje -> 201', async () => {
    const res = await request(http)
      .post('/api/viajes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        origen: 'Buenos Aires',
        destino_principal: 'Córdoba',
        fecha_inicio: '2026-09-10',
        fecha_fin: '2026-09-12',
        cantidad_personas: 2,
        presupuesto_total: 1200,
      })
      .expect(201);
    expect(res.body.id_viaje).toEqual(expect.any(Number));
    idViaje = res.body.id_viaje;
  });

  it('con un borrador abierto no deja crear otro viaje (409)', async () => {
    const res = await request(http)
      .post('/api/viajes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        origen: 'Buenos Aires',
        destino_principal: 'Mendoza',
        fecha_inicio: '2026-10-10',
        fecha_fin: '2026-10-12',
      })
      .expect(409);
    expect(res.body).toMatchObject({ codigo: 'BORRADOR_EXISTENTE', idViaje });
  });

  it('generar itinerario con IA (Gemini real) -> 201 con días', async () => {
    const res = await request(http)
      .post(`/api/viajes/${idViaje}/itinerario/generar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(Array.isArray(res.body.dias_itinerario)).toBe(true);
    expect(res.body.dias_itinerario.length).toBeGreaterThan(0);
  }, 120_000);

  it('ver presupuesto (derivado del itinerario) -> 200', async () => {
    const res = await request(http)
      .get(`/api/viajes/${idViaje}/presupuesto`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number(res.body.monto_total)).toBeGreaterThanOrEqual(0);
    // la suma de categorías debe dar el total
    const suma =
      Number(res.body.monto_vuelos) +
      Number(res.body.monto_alojamiento) +
      Number(res.body.monto_comidas) +
      Number(res.body.monto_transporte_local) +
      Number(res.body.monto_actividades);
    expect(Math.abs(suma - Number(res.body.monto_total))).toBeLessThan(0.01);
  });

  it('plan Gratis: buscar vuelos no está incluido (403 LIMITE_PLAN)', async () => {
    const res = await request(http)
      .post(`/api/viajes/${idViaje}/vuelos/buscar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body).toMatchObject({
      codigo: 'LIMITE_PLAN',
      planActual: 'GRATIS',
      planSugerido: 'BASE',
    });
  });

  it('con plan Premium asignado, mi-plan lo refleja', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email },
    });
    const ahora = new Date();
    await prisma.suscripcion.create({
      data: {
        id_usuario: usuario.id_usuario,
        plan: 'PREMIUM',
        estado: 'ACTIVA',
        dia_ancla: ahora,
        vigente_desde: ahora,
      },
    });

    const res = await request(http)
      .get('/api/planes/mi-plan')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.plan).toBe('PREMIUM');
  });

  // Los endpoints de pagos que no llegan a llamar a Mercado Pago.
  it('pagos: suscribirse al plan Gratis no es válido (400)', async () => {
    await request(http)
      .post('/api/planes/suscribir')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'GRATIS' })
      .expect(400);
  });

  it('pagos: con un plan asignado a mano no hay suscripción que cancelar (404)', async () => {
    await request(http)
      .post('/api/planes/cancelar')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('pagos: no muestra una suscripción que no es del usuario (404)', async () => {
    await request(http)
      .get('/api/planes/suscripciones/999999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('pagos: el webhook rechaza una notificación con firma inválida (401)', async () => {
    await request(http)
      .post('/api/pagos/webhook?data.id=123&type=subscription_preapproval')
      .set('x-signature', 'ts=1789437600,v1=firma-falsa')
      .set('x-request-id', 'e2e')
      .send({ type: 'subscription_preapproval', data: { id: '123' } })
      .expect(401);
  });

  it('pagos: la vuelta del checkout redirige al frontend', async () => {
    const res = await request(http)
      .get('/api/pagos/volver?preapproval_id=abc')
      .expect(302);
    expect(res.headers.location).toMatch(
      /\/planes\/resultado\?preapproval_id=abc$/,
    );
  });

  it('buscar vuelos (mock) -> guarda opciones ordenadas por precio', async () => {
    const res = await request(http)
      .post(`/api/viajes/${idViaje}/vuelos/buscar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const precios = res.body.map((v: any) => Number(v.precio));
    expect([...precios].sort((a, b) => a - b)).toEqual(precios);
  });

  // Timeout propio, igual que generar: Booking va mockeado, pero el ranking usa
  // Gemini real y cada hotel se enriquece con Google Places real. Con los 5 s por
  // defecto, Jest abandona el test mientras el request sigue corriendo, y ese
  // request después choca con el borrado de la cuenta del afterAll (deadlock).
  it('buscar alojamiento (mock) -> guarda opciones ordenadas por precio/noche', async () => {
    const res = await request(http)
      .post(`/api/viajes/${idViaje}/alojamiento/buscar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  }, 120_000);

  it('IDOR: otro usuario no puede ver este viaje (403)', async () => {
    const otro = `e2e_otro_${Date.now()}@test.com`;
    const reg = await request(http)
      .post('/api/auth/register')
      .send({ nombre: 'Otro', apellido: 'User', email: otro, password })
      .expect(201);
    const tokenOtro = reg.body.access_token;

    await request(http)
      .get(`/api/viajes/${idViaje}`)
      .set('Authorization', `Bearer ${tokenOtro}`)
      .expect(403);

    // limpiar el segundo usuario
    await request(http)
      .delete('/api/usuarios/me')
      .set('Authorization', `Bearer ${tokenOtro}`)
      .send({ password })
      .expect(200);
  });
});
