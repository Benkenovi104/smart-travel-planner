import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { AppModule } from './../src/app.module';
import { PrismaExceptionFilter } from './../src/common/filters/prisma-exception.filter';

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

  const email = `e2e_${Date.now()}@test.com`;
  const password = 'password123';

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
  });

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
  });

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

  it(
    'generar itinerario con IA (Gemini real) -> 201 con días',
    async () => {
      const res = await request(http)
        .post(`/api/viajes/${idViaje}/itinerario/generar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(Array.isArray(res.body.dias_itinerario)).toBe(true);
      expect(res.body.dias_itinerario.length).toBeGreaterThan(0);
    },
    120_000,
  );

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

  it('buscar alojamiento (mock) -> guarda opciones ordenadas por precio/noche', async () => {
    const res = await request(http)
      .post(`/api/viajes/${idViaje}/alojamiento/buscar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

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
