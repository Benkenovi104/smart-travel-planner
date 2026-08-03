# Smart Travel Planner

Sistema inteligente de planificación de viajes con optimización de rutas y recomendaciones personalizadas.

## Descripción General

Smart Travel Planner es una aplicación web que ayuda a los usuarios a organizar itinerarios turísticos de manera automática, personalizada y optimizada.

La plataforma permite que cada usuario cree una cuenta, configure su **perfil de viajero** y genere viajes según sus preferencias, fechas, presupuesto y destino. A partir de esta información, el sistema construye un itinerario día por día, sugiriendo actividades, lugares de interés, rutas y opciones estimadas de vuelo y alojamiento. Además, el usuario puede modificar manualmente el itinerario generado y volver a optimizarlo según los cambios realizados.

## Objetivos

- Planificación automática de itinerarios
- Recomendaciones personalizadas basadas en el perfil del viajero
- Optimización de recorridos (minimización de desplazamientos)
- Integración con APIs externas de lugares, vuelos y alojamiento
- Visualización geográfica interactiva en mapa
- Estimación de costos del viaje

## Flujo Principal del Sistema

```
1. Registro → Configuración del perfil de viajero
2. Creación del viaje, guiada en 4 pasos:
     1) Datos: destino, fechas, personas, presupuesto e intereses del viaje
     2) Elección de vuelo         ← opcional, se puede omitir
     3) Elección de alojamiento   ← opcional, se puede omitir
     4) Resumen y generación del itinerario
3. Al generar: consulta de lugares reales del destino + armado del plan día por día con IA
4. Edición manual: agregar, editar, mover y reordenar actividades
5. Optimización del recorrido de cada día (minimiza traslados)
6. Visualización en mapa y seguimiento del presupuesto
```

> **Creación guiada.** Hasta hace poco sólo el paso de datos estaba pautado y el resto quedaba a criterio del usuario: se podía elegir hotel antes que vuelo, o generar el itinerario sin ninguno de los dos. Ahora la primera pasada sigue una secuencia fija. Vuelos y alojamiento son los únicos pasos salteables, y se pueden completar después desde las pestañas del viaje, como siempre.
>
> Mientras el wizard está en curso el viaje vive en estado **`borrador`**: ya existe en la base (hace falta para buscar vuelos y alojamiento, que van scopeados al viaje), aparece en el dashboard marcado como tal y con un botón para retomarlo en el paso donde quedó. Al terminar pasa a `planificado` y se abre la vista completa con pestañas (Itinerario, Mapa, Presupuesto, Vuelos, Alojamiento).

## Perfil de Viajero e Intereses

El sistema maneja dos niveles de preferencias:

**Intereses generales del usuario** (permanentes en el perfil):
gastronomía, cultura, naturaleza, historia, aventura, vida nocturna, etc.

**Intereses específicos del viaje** (por cada viaje creado):
Un usuario con intereses generales en gastronomía y cultura puede priorizar nieve y trekking para un viaje a Bariloche, y teatro y museos para uno a Buenos Aires.

## Funcionalidades Principales

| Funcionalidad | Estado | Descripción |
|---|---|---|
| Creación guiada del viaje | ✅ | Wizard de 4 pasos (datos → vuelo → alojamiento → resumen); vuelo y alojamiento son salteables |
| Generación de itinerarios | ✅ | Plan completo por días según destino, fechas, presupuesto e intereses (Gemini) |
| Recomendaciones personalizadas | ✅ | Combina perfil general + intereses del viaje + lugares reales del destino |
| Visualización en mapa | ✅ | Marcadores numerados y rutas por día, filtro por día y pin del alojamiento elegido |
| Estimación de presupuesto | ✅ | Desglose por vuelos, alojamiento, comidas, transporte y actividades, más detalle por gasto |
| Vuelos y alojamiento | ✅ | Consulta de opciones vía APIs externas (sin reserva real); la opción elegida suma al presupuesto |
| Edición del itinerario | ✅ | Agregar, eliminar, mover entre días y reordenar con drag & drop, con historial de cambios |
| Edición del viaje | ✅ | Cambiar fechas, personas, presupuesto, intereses y estado; el presupuesto se recalcula solo |
| Guardado de viajes | ✅ | Acceso futuro y reutilización de preferencias |
| Optimización de rutas | ✅ | Botón "Optimizar" por día: reordena las paradas por cercanía (nearest-neighbor + 2-opt) y corre los horarios a la nueva secuencia |

> **Nota:** Las integraciones de vuelos y alojamiento son informativas y de simulación. El objetivo académico del proyecto es la planificación inteligente del viaje, no la comercialización ni gestión de reservas reales.

## Modelo Lógico de Datos

### Usuarios y Perfil de Viajero
- `usuarios` — Información básica de la cuenta
- `perfil_viajero` — Preferencias generales (ritmo, presupuesto habitual, tipo de viajero)
- `intereses` — Catálogo general de intereses turísticos
- `usuario_intereses` — Relación usuario ↔ intereses del perfil

### Viajes
- `viajes` — Cada viaje creado (destino, fechas, personas, presupuesto, estado)
- `viaje_intereses` — Intereses específicos de cada viaje

El `estado` arranca en `borrador` mientras el usuario recorre el wizard de creación y pasa a `planificado` al terminarlo; de ahí en más lo maneja el usuario (`en_progreso`, `completado`, `cancelado`). `borrador` es el único que no se puede setear a mano.

### Planificación del Itinerario
- `itinerarios` — Plan general generado para un viaje
- `dias_itinerario` — División del itinerario por días
- `lugares` — Puntos de interés (turísticos, restaurantes, atracciones, etc.)
- `actividades_itinerario` — Lugar + día + orden + horario + costo estimado

### Presupuesto
- `presupuestos` — Resumen general de costos estimados
- `gastos_estimados` — Detalle por categoría o actividad

### Opciones Externas
- `opciones_vuelo` — Vuelos sugeridos desde APIs externas
- `opciones_alojamiento` — Alojamientos sugeridos desde APIs externas

Ambas tienen un flag `seleccionado`: a lo sumo una opción de cada tipo queda elegida por viaje, y es la que suma al presupuesto. El alojamiento se modela acá y **no** como una actividad del itinerario, porque es un costo del viaje y no algo que ocurre en un día a una hora.

### Historial
- `cambios_itinerario` — Registro de modificaciones del usuario (trazabilidad)

## APIs y Servicios Externos

| Categoría | Servicio en uso | Notas |
|---|---|---|
| Generación de itinerarios | Google Gemini (`@google/genai`) | Arma el plan día por día |
| Lugares turísticos | Google Places API (New) — Text Search | Cacheados en la tabla `lugares` |
| Geocoding | Nominatim / OpenStreetMap | Gratis y sin API key; ubica actividades sin coordenadas |
| Mapas | Leaflet + OpenStreetMap | Sin API key |
| Vuelos | Sky Scrapper, vía RapidAPI | Mirror no oficial de Skyscanner |
| Alojamiento | Booking.com (`booking-com15`), vía RapidAPI | Mirror no oficial |
| Email | Nodemailer + SMTP (Gmail) | Recuperación de contraseña |

Vuelos y alojamiento usan el free tier de RapidAPI, que es **muy** chico: el plan BASIC de Sky Scrapper son 20 requests por mes y **cada búsqueda de vuelos gasta 4** (resolver los dos aeropuertos + ida y vuelta), o sea 5 búsquedas mensuales. Cuando se agota, la API devuelve **429 y eso no es un bug**; el backend lo propaga como un 429 con un mensaje claro en vez de confundirlo con un destino irresoluble. Ojo que el ciclo de RapidAPI se cuenta **desde el día de alta de la suscripción, no desde el 1° de cada mes**. Cada API tiene su cuota propia: que se agote la de vuelos no afecta a la de alojamiento.

Para desarrollar sin gastar cuota existe `RAPIDAPI_MOCK=true`, que usa datos fixture.

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | NestJS 11 (Node.js / TypeScript, ESM) |
| **Frontend** | Next.js 16 (App Router) / React 19 / TypeScript |
| **Base de datos** | PostgreSQL + Prisma 7 (Supabase en la nube, Postgres local con Docker) |
| **Auth** | JWT (Passport + bcrypt), guardado en cookie `httpOnly` vía BFF |
| **Estilos** | TailwindCSS 4 + shadcn/ui |
| **Datos en el cliente** | TanStack Query v5 |
| **Mapas** | Leaflet + OpenStreetMap |

## Estructura del Proyecto

```
smart-travel-planner/
├── backend/            # API REST con NestJS — ver backend/README.md
│   ├── src/            # Módulos: auth, usuarios, viajes, itinerarios,
│   │                   # presupuestos, lugares, vuelos, alojamiento, mail
│   ├── prisma/         # Schema y migraciones
│   ├── test/           # Tests e2e (los unitarios viven junto a cada service)
│   ├── Dockerfile
│   └── docker-compose.yml
└── frontend/           # Aplicación web con Next.js — ver frontend/README.md
    ├── app/            # Rutas (App Router) + BFF proxy en app/api
    ├── components/     # UI por dominio (itinerario, mapa, reservas, …)
    ├── lib/            # Cliente de API, hooks de TanStack Query, tipos
    └── proxy.ts        # Guard de rutas (el ex middleware.ts de Next 15)
```

Cada subproyecto tiene su propio README con el detalle de arquitectura, variables de entorno y decisiones de diseño.

## Requisitos

- Node.js 20+
- PostgreSQL (o acceso a una instancia Supabase)
- npm / pnpm

## Instalación y Desarrollo

### Backend

```bash
cd backend
npm install
cp .env.example .env   # completar DATABASE_URL, JWT_SECRET y las API keys
npx prisma generate
npx prisma db push     # sincroniza el schema con la base
npm run seed           # carga el catálogo de intereses
npm run start:dev
```

Arranca en `http://localhost:3000`, con prefijo global `/api` y Swagger en `/api/docs`. Si falta una variable de entorno requerida, no arranca y dice cuál.

Alternativa sin Supabase: `docker compose up --build` levanta el backend junto a un Postgres local.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Arranca en `http://localhost:3001`. Necesita el backend corriendo.

## Scripts Disponibles

### Backend

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Servidor en modo desarrollo (watch) |
| `npm run start:prod` | Servidor en modo producción (requiere `npm run build`) |
| `npm run seed` | Carga el catálogo de intereses (idempotente) |
| `npm run test` | Tests unitarios (11 suites, 78 tests) |
| `npm run test:e2e` | Tests end-to-end (hace una llamada real a Gemini) |
| `npm run lint` | ESLint con `--fix` |

### Frontend

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3001) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build (puerto 3001) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Chequeo de tipos |

## Alcance — Primera Versión

- [x] Estructura base backend (NestJS) y frontend (Next.js + App Router)
- [x] Modelos de datos, schema de Prisma y migraciones
- [x] Registro, inicio de sesión y JWT en cookie `httpOnly` (BFF)
- [x] Gestión de cuenta: cambio de contraseña, recuperación por email, borrado de cuenta
- [x] Perfil de viajero e intereses generales
- [x] Creación de viajes con intereses específicos
- [x] Creación guiada por pasos (datos → vuelo → alojamiento → resumen), con los viajes a medio armar guardados como borrador y retomables
- [x] Consulta de lugares turísticos desde APIs (Google Places, cacheado)
- [x] Generación automática del itinerario por días (Gemini)
- [x] Edición manual del itinerario (agregar, editar, eliminar, drag & drop entre días)
- [x] Historial de cambios del itinerario
- [x] Visualización en mapa (Leaflet + OSM, con geocoding de respaldo)
- [x] Estimación de presupuesto, con desglose por categoría y detalle por gasto
- [x] Sugerencia de vuelos y alojamiento (sin reserva real), con selección que impacta el presupuesto
- [x] Endpoints de API y documentación con Swagger
- [x] Componentes de UI, manejo global de errores y diseño responsive
- [x] Tests unitarios y e2e del backend
- [x] Configuración Docker (backend + Postgres)
- [x] Editar un viaje ya creado (fechas, personas, presupuesto, estado), con recálculo del presupuesto
- [x] Autocompletado de lugares reales al agregar una actividad
- [x] Optimización de recorridos por día (heurística tipo TSP: nearest-neighbor + 2-opt), con los horarios corridos a la nueva secuencia

## Futuras Mejoras

- Chatbot de viajes integrado
- Predicción y adaptación automática del itinerario según el clima
- Recomendaciones generadas con IA
- Compartir viajes entre usuarios
- Exportar itinerarios a PDF
- Versión móvil o PWA
- Historial de cambios completo del itinerario
- Sistema de favoritos y lugares guardados

## Autores

- **Santiago Purro**
- **Santiago Intili**

## Licencia

MIT © 2026 Santiago Purro & Santiago Intili
