# Smart Travel Planner — Backend

API REST del [Smart Travel Planner](../README.md), construida con NestJS 11 y Prisma 7 sobre PostgreSQL. Expone autenticación y gestión de cuenta (incluida recuperación de contraseña por email), perfil de viajero, gestión de viajes, generación/edición de itinerarios asistida por IA (Google Gemini), presupuesto automático, y búsqueda de lugares/vuelos/alojamiento reales. Empaquetado con Docker y cubierto por una suite de tests unitarios y e2e.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (Node.js / TypeScript, ESM) |
| Base de datos | PostgreSQL vía Prisma 7 con `@prisma/adapter-pg` (Supabase en prod, Postgres local en dev con Docker) |
| Auth | Passport + JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt |
| Email | Nodemailer + SMTP (Gmail) — mail de recuperación de contraseña |
| IA | Google Gemini (`@google/genai`) para generación de itinerarios |
| Lugares reales | Google Places API (New) — Text Search, para fundamentar los itinerarios en POIs verificados |
| Vuelos y alojamiento | RapidAPI — Sky Scrapper (vuelos) y Booking.com/`booking-com15` (alojamiento) |
| Docs | Swagger (`@nestjs/swagger`) |
| Rate limiting | `@nestjs/throttler` |
| Validación | `class-validator` / `class-transformer` |
| Tests | Jest + Supertest (unitarios + e2e) |
| Contenedores | Docker (multi-stage) + Docker Compose |

## Instalación (local)

```bash
npm install
cp .env.example .env   # completar variables, ver tabla abajo
npx prisma generate
npx prisma db push     # sincroniza el schema con la base (no se usan migraciones)
npm run seed           # carga el catálogo de intereses turísticos
npm run start:dev
```

El servidor arranca en `http://localhost:3000` con prefijo global `/api`. La app **valida las variables de entorno al bootstrap**: si falta alguna requerida, no arranca y tira un error explicando cuál falta.

## Instalación (con Docker)

Levanta el backend **junto a un Postgres local**, sin depender de Supabase:

```bash
docker compose up --build
```

Esto arranca dos servicios: `db` (Postgres 16) y `backend`. En el arranque, el backend sincroniza el schema (`prisma db push`) y siembra los intereses automáticamente. Necesitás un `.env` con las **API keys** (Gemini, Google Places, RapidAPI, JWT, SMTP) — el `DATABASE_URL` del `.env` se **ignora** en Docker: el compose lo sobreescribe para apuntar al Postgres del contenedor.

- Puerto del backend configurable con `BACKEND_PORT` (default `3000`), el de la DB con `DB_PORT` (default `5433`).
- La imagen es agnóstica de la base: en producción se le pasa `DATABASE_URL` (ej. Supabase) por variable de entorno y usa esa, con el mismo código.

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Connection string de Postgres (Supabase Session Pooler en prod; con Docker lo pisa el compose). |
| `JWT_SECRET` | Sí | Secreto para firmar JWT. Mínimo 32 caracteres. |
| `GEMINI_API_KEY` | Sí | API key de Google Gemini, usada para generar itinerarios. |
| `GOOGLE_PLACES_API_KEY` | Sí | API key con "Places API (New)" habilitada en Google Cloud (requiere billing habilitado). Usada para buscar lugares turísticos reales. |
| `RAPIDAPI_KEY` | Sí | API key de RapidAPI, con suscripción (free tier) a "Sky Scrapper" (vuelos) y "Booking COM" (`booking-com15`, alojamiento). |
| `RAPIDAPI_MOCK` | No | `"true"` para usar datos fixture en vuelos/alojamiento sin pegarle a RapidAPI (no gasta cuota; útil en dev/demos). Los hoteles fixture están **por ciudad** (hoy Mendoza y Córdoba, con coordenadas aproximadas); una ciudad sin fixture cae en Mendoza y avisa por log. Default `"false"`. |
| `SMTP_HOST` / `SMTP_PORT` | No | Servidor SMTP para el mail de recuperación de contraseña (Gmail: `smtp.gmail.com` / `465`). |
| `SMTP_USER` / `SMTP_PASS` | No* | Cuenta remitente y su **App Password** (Gmail requiere 2FA + App Password de 16 chars). *Requeridas para que `forgot-password` funcione; la app arranca sin ellas. |
| `MAIL_FROM` | No | Dirección "De:" del mail (con Gmail, igual a `SMTP_USER`). |
| `PORT` | No | Puerto del servidor (default `3000`). |
| `FRONTEND_URL` | No | Origen permitido por CORS y base del link de reseteo de contraseña (default `http://localhost:3001`). |
| `NODE_ENV` | No | `development` \| `production` \| `test`. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | No | Reservadas para una futura integración directa con el SDK de Supabase. Hoy la app solo usa `DATABASE_URL`; estas variables no se leen en el código. |

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo desarrollo (watch). |
| `npm run start:prod` | Servidor en modo producción (requiere `npm run build` antes). |
| `npm run build` | Compila a `dist/`. |
| `npm run seed` | Carga el catálogo de intereses turísticos en la base (idempotente). |
| `npm run test` | Tests unitarios (Jest, ESM). |
| `npm run test:e2e` | Tests end-to-end (ver sección Tests). |
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
| `auth` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | Registro/login con JWT (bcrypt, 7 días). Cambio de contraseña (autenticado) y recuperación por email (token SHA-256 con vencimiento de 1h). Rate limit de 5 intentos/minuto. |
| `usuarios` | `/api/usuarios/*` | Perfil propio, perfil de viajero (ritmo, presupuesto, tipo), catálogo e intereses del usuario, y **borrado de cuenta** (`DELETE /api/usuarios/me`, con confirmación de contraseña y cascade completo). |
| `viajes` | `/api/viajes/*` | CRUD de viajes, scopeado por usuario, con intereses específicos por viaje. |
| `itinerarios` | `/api/viajes/:idViaje/itinerario/*` | Generación de itinerario con IA (Gemini), consulta, y edición manual: agregar/editar/eliminar/mover actividades entre días, con historial de cambios (`GET .../cambios`). `POST .../geocodificar` ubica por lotes las actividades sin coordenadas. |
| `presupuestos` | `GET /api/viajes/:idViaje/presupuesto` | Desglose por categoría + detalle de gastos, recalculado automáticamente al mutar el itinerario o al elegir vuelo/alojamiento. |
| `lugares` | `GET /api/lugares/buscar` | Búsqueda de lugares turísticos reales (Google Places), cacheados en la tabla `lugares` y reutilizados como contexto al generar itinerarios. También expone el geocoding con Nominatim/OSM (sin API key). |
| `vuelos` | `/api/viajes/:idViaje/vuelos/*` | Busca opciones reales (Sky Scrapper, ida y vuelta combinadas) y las guarda en `opciones_vuelo` ordenadas por precio. `PATCH .../:idVuelo/seleccionar` elige una (exclusiva por viaje) y recalcula el presupuesto. |
| `alojamiento` | `/api/viajes/:idViaje/alojamiento/*` | Ídem con Booking.com, ordenadas por precio por noche. `PATCH .../:idAlojamiento/seleccionar` elige una y suma `precio_por_noche × noches` al presupuesto. |

Todos los endpoints salvo `auth` y `health` requieren `Authorization: Bearer <token>` (`JwtAuthGuard`). La estrategia JWT **verifica contra la base que el usuario siga existiendo**: el token de una cuenta borrada da 401 de inmediato, sin esperar a que venza.

### Dos reglas de dominio que conviene conocer

- **El alojamiento no es una actividad del itinerario**, sino un costo del viaje. `alojamiento` no es un `tipo_actividad` válido (ver `itinerarios/dto/tipos-actividad.ts`); el usuario elige un hotel por viaje y de ahí sale `monto_alojamiento`. Se le pide a Gemini que no lo genere **y además se filtra al persistir**, porque el modelo ignora la instrucción con frecuencia.
- **Los precios ya vienen calculados para todo el grupo.** `OpcionVuelo.precio` es el total ida+vuelta (la búsqueda consulta la API con `cantidadPersonas` adultos) y `precio_por_noche` también está prorrateado. **No hay que multiplicar por la cantidad de personas.**

> Nota: los datos de vuelos/alojamiento vienen de mirrors no oficiales de Skyscanner y Booking.com en RapidAPI — son informativos/de simulación, no hay integración de reserva real. Para desarrollar sin gastar cuota, ver `RAPIDAPI_MOCK`.

## Tests

```bash
npm test           # unitarios (~3s)
npm run test:e2e   # end-to-end (~90s, hace 1 llamada real a Gemini)
```

- **Unitarios** (9 suites, 49 tests): cada service aislado, mockeando Prisma y las APIs externas (Gemini/Google/RapidAPI/Mail) por inyección de dependencias; bcrypt/crypto corren reales. Cubren auth (register/login/cambio/forgot/reset), la estrategia JWT (rechaza tokens de cuentas borradas), borrado de cuenta con cascade, IDOR en viajes, matemática del presupuesto (incluidos vuelo y alojamiento elegidos), ranking y selección de vuelos/alojamiento, y los guards de itinerarios.
- **E2E** (`test/main-flow.e2e-spec.ts`): bootstrapea la `AppModule` real y recorre el flujo completo **contra la base configurada en `.env`** con **Gemini real** y `RAPIDAPI_MOCK=true`: registro → login → crear viaje → generar itinerario con IA → presupuesto → vuelos/alojamiento → IDOR 403. Crea y borra sus propios usuarios (se autolimpia).

## Base de datos

El schema de Prisma (`prisma/schema.prisma`) modela usuarios, perfil de viajero, intereses, viajes, itinerarios, días, lugares, actividades, presupuesto, gastos y opciones de vuelo/alojamiento. El cliente generado va a `generated/prisma` (gitignoreado, se regenera con `npx prisma generate`).

Conviven dos flujos, según el entorno:

- **Local y Docker**: `npx prisma db push` sincroniza el schema directamente contra la base. Es lo que corre el `docker-compose` al arrancar.
- **Supabase**: la base está versionada con las migraciones de `prisma/migrations/`, que se aplican con `npx prisma migrate deploy`. Nunca uses `migrate dev` contra Supabase: ante una divergencia ofrece resetear la base.

> Nota: el schema usa `onDelete: NoAction` en todas las relaciones — los borrados en cascada (viaje → itinerario → días → actividades, etc., y usuario → viajes/perfil/intereses) se manejan explícitamente en los services dentro de transacciones, no a nivel de base de datos.

## Estado del proyecto

Backend **funcionalmente completo**: autenticación y gestión de cuenta, perfil de viajero, viajes, itinerarios con IA y edición manual, presupuesto automático, lugares reales, vuelos y alojamiento, más hardening (validación de env, rate limiting, transacciones, health check), suite de tests y empaquetado con Docker.
