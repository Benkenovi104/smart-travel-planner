# Smart Travel Planner — Backend

API REST del [Smart Travel Planner](../README.md), construida con NestJS 11 y Prisma 7 sobre PostgreSQL (Supabase). Expone autenticación, perfil de viajero, gestión de viajes y generación/edición de itinerarios asistida por IA (Google Gemini).

## Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (Node.js / TypeScript, ESM) |
| Base de datos | PostgreSQL (Supabase) vía Prisma 7 con `@prisma/adapter-pg` |
| Auth | Passport + JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt |
| IA | Google Gemini (`@google/genai`) para generación de itinerarios |
| Lugares reales | Google Places API (New) — Text Search, para fundamentar los itinerarios en POIs verificados |
| Vuelos y alojamiento | RapidAPI — Sky Scrapper (vuelos) y Booking.com/`booking-com15` (alojamiento) |
| Docs | Swagger (`@nestjs/swagger`) |
| Rate limiting | `@nestjs/throttler` |
| Validación | `class-validator` / `class-transformer` |

## Instalación

```bash
npm install
cp .env.example .env   # completar variables, ver tabla abajo
npx prisma generate
npx prisma migrate deploy   # o "migrate dev" si es la primera vez y no existe la migración en la DB
npm run start:dev
```

El servidor arranca en `http://localhost:3000` con prefijo global `/api`. La app **valida las variables de entorno al bootstrap**: si falta alguna requerida, no arranca y tira un error explicando cuál falta.

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Connection string de Postgres (Supabase, Session Pooler recomendado). |
| `JWT_SECRET` | Sí | Secreto para firmar JWT. Mínimo 32 caracteres. |
| `GEMINI_API_KEY` | Sí | API key de Google Gemini, usada para generar itinerarios. |
| `GOOGLE_PLACES_API_KEY` | Sí | API key con "Places API (New)" habilitada en Google Cloud (requiere billing habilitado en el proyecto, aunque no debería cobrar en este volumen). Usada para buscar lugares turísticos reales. |
| `RAPIDAPI_KEY` | Sí | API key de RapidAPI, con suscripción (free tier) a "Sky Scrapper" (vuelos) y "Booking COM" (`booking-com15`, alojamiento). |
| `PORT` | No | Puerto del servidor (default `3000`). |
| `FRONTEND_URL` | No | Origen permitido por CORS (default `http://localhost:3001`). |
| `NODE_ENV` | No | `development` \| `production` \| `test`. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | No | Reservadas para una futura integración directa con el SDK de Supabase (auth/storage). Hoy la app solo usa `DATABASE_URL` para hablarle a Postgres; estas variables no se leen todavía en el código. |

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo desarrollo (watch). |
| `npm run start:prod` | Servidor en modo producción (requiere `npm run build` antes). |
| `npm run build` | Compila a `dist/`. |
| `npm run seed` | Carga el catálogo de intereses turísticos en la base. |
| `npm run test` | Tests unitarios (Jest, ESM). |
| `npm run test:e2e` | Tests end-to-end — bootstrapean la `AppModule` real y pegan contra la base configurada en `.env`. |
| `npm run test:cov` | Tests unitarios con cobertura. |
| `npm run lint` | ESLint con `--fix`. |
| `npm run format` | Prettier sobre `src` y `test`. |

## Documentación interactiva

Con el servidor corriendo:

- **Swagger UI**: `http://localhost:3000/api/docs` — todos los endpoints, DTOs y respuestas documentados, con soporte de Bearer auth para probar endpoints protegidos.
- **Health check**: `http://localhost:3000/api/health` — verifica que el servidor y la conexión a la base estén vivos.

## Módulos y endpoints principales

| Módulo | Rutas base | Qué hace |
|---|---|---|
| `auth` | `POST /api/auth/register`, `POST /api/auth/login` | Registro/login con JWT (bcrypt, 7 días de expiración). Rate limit de 5 intentos/minuto. |
| `usuarios` | `/api/usuarios/*` | Perfil propio, perfil de viajero (ritmo, presupuesto, tipo), catálogo e intereses generales del usuario. |
| `viajes` | `/api/viajes/*` | CRUD de viajes, scopeado por usuario, con intereses específicos por viaje. |
| `itinerarios` | `/api/viajes/:idViaje/itinerario/*` | Generación de itinerario con IA (Gemini), consulta, y edición manual: agregar/editar/eliminar/mover actividades entre días, con historial de cambios (`GET .../cambios`). |
| `presupuestos` | `GET /api/viajes/:idViaje/presupuesto` | Desglose de presupuesto por categoría + detalle de gastos, recalculado automáticamente en cada mutación del itinerario. |
| `lugares` | `GET /api/lugares/buscar` | Búsqueda de lugares turísticos reales (Google Places), cacheados en la tabla `lugares` y reutilizados como contexto al generar itinerarios. |
| `vuelos` | `/api/viajes/:idViaje/vuelos/*` | Búsqueda de opciones de vuelo reales (Sky Scrapper, ida y vuelta combinadas), guardadas en `opciones_vuelo` ordenadas por precio. |
| `alojamiento` | `/api/viajes/:idViaje/alojamiento/*` | Búsqueda de opciones de alojamiento reales (Booking.com), guardadas en `opciones_alojamiento` ordenadas por precio por noche. |

Todos los endpoints salvo `auth` y `health` requieren `Authorization: Bearer <token>` (`JwtAuthGuard`).

> Nota: los datos de vuelos/alojamiento vienen de mirrors no oficiales de Skyscanner y Booking.com en RapidAPI — son informativos/de simulación (como aclara el README raíz del proyecto), no hay integración de reserva real.

## Base de datos

El schema de Prisma (`prisma/schema.prisma`) modela usuarios, perfil de viajero, intereses, viajes, itinerarios, días, lugares, actividades, presupuesto y opciones de vuelo/alojamiento. Las migraciones viven en `prisma/migrations/`. El cliente generado va a `generated/prisma` (gitignoreado, se regenera con `npx prisma generate`).

> Nota: el schema usa `onDelete: NoAction` en todas las relaciones — los borrados en cascada (viaje → itinerario → días → actividades, etc.) se manejan explícitamente en los services dentro de transacciones, no a nivel de base de datos.

## Estado del proyecto

Este backend se está completando en bloques de trabajo incrementales. Para el detalle de qué está implementado, qué falta y en qué orden se está trabajando, ver:

- [`ESTADO_BACKEND.md`](./ESTADO_BACKEND.md) — análisis completo del estado actual.
- [`PENDIENTES_BACKEND.md`](./PENDIENTES_BACKEND.md) — checklist de trabajo pendiente, en el orden acordado.
