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
| Planes de uso | ✅ | Planes Gratis, Base y Premium con suscripción mensual vía Mercado Pago, límites aplicados en el backend y "Mi plan" en el perfil — ver [Planes de Uso](#planes-de-uso) |

> **Nota:** Las integraciones de vuelos y alojamiento son informativas: la app muestra opciones y precios, pero no gestiona reservas reales. Lo que **sí** se cobra de verdad son los planes de uso, vía Mercado Pago.

## Planes de Uso

La app ofrece tres planes. Los límites apuntan a lo que le cuesta a la app cada acción: crear un viaje es gratis, pero generar un itinerario o buscar vuelos y alojamiento consume servicios externos pagos o con cuota.

| | Gratis | Base | Premium |
|---|---|---|---|
| Precio mensual | $ 0 | $ 12.500 | $ 38.500 |
| Viajes por período | 1 | 5 | Sin límite |
| Generar itinerario con IA | 1 vez por viaje | ✓ | ✓ |
| Regenerar itinerario | ✗ | 3 por viaje | Sin límite |
| Editar, mapa y presupuesto | ✓ | ✓ | ✓ |
| Optimizar recorrido | ✗ | ✓ | ✓ |
| Buscar alojamiento | 1 por viaje | 3 por viaje | Sin límite |
| Buscar vuelos | ✗ | 1 por viaje | 3 por viaje |

- Los planes pagos son una **suscripción mensual de Mercado Pago** que se renueva sola. El período se cuenta desde el día del pago: si pagaste el 13 de agosto, se renueva el 13 de septiembre.
- Los límites se aplican en el backend. Una acción cuenta solo si sale bien, y borrar un viaje no devuelve el cupo.
- El plan se activa recién cuando Mercado Pago confirma el cobro: lo avisa por webhook, y además la app consulta la API de Mercado Pago cuando el usuario vuelve del checkout y cuando un plan llega a su renovación. Volver a la app sin pagar no activa nada, y la app nunca maneja datos de tarjeta.
- Los precios se cobran en pesos, porque Mercado Pago Argentina no acepta suscripciones en otra moneda. Cancelar conserva el plan hasta el fin del período pagado.

Documentación completa en [docs/PLANES.md](docs/PLANES.md): límites, períodos, cambios de plan, qué cuenta y qué no.

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

### Planes y Suscripciones
- `suscripciones` — Plan de cada usuario, su estado y su período vigente, vinculado a la suscripción de Mercado Pago
- `pagos_suscripcion` — Cada cobro confirmado por Mercado Pago
- `consumos` — Registro de cada acción que cuenta para los límites del plan

Un usuario sin suscripción vigente está en el plan Gratis. Los `consumos` no tienen relación con `viajes` a propósito: el borrado de un viaje es físico, y si el consumo se borrara en cascada el usuario recuperaría el cupo.

## APIs y Servicios Externos

| Categoría | Servicio en uso | Notas |
|---|---|---|
| Generación de itinerarios | Google Gemini (`@google/genai`) | Arma el plan día por día |
| Lugares turísticos | Google Places API (New) — Text Search | Cacheados en la tabla `lugares` |
| Geocoding | Nominatim / OpenStreetMap | Gratis y sin API key; ubica actividades sin coordenadas |
| Mapas | Leaflet + OpenStreetMap | Sin API key |
| Vuelos | [Ignav](https://ignav.com) | Tarifas en vivo y links de reserva |
| Alojamiento | Booking.com (`booking-com15`), vía RapidAPI | Mirror no oficial |
| Email | Nodemailer + SMTP (Gmail) | Recuperación de contraseña |
| Pagos y suscripciones | Mercado Pago — API de Suscripciones (`preapproval`) + webhooks | SDK oficial `mercadopago`, cobro en pesos — ver [docs/PLANES.md](docs/PLANES.md) |

Los vuelos salen de Ignav: **1.000 requests gratis por única vez** y después USD 2 cada 1.000, sin mínimo mensual. Cada búsqueda gasta **2 requests de tarifas** (ida y vuelta); la resolución de aeropuertos se cachea en memoria, así que sólo cuesta la primera vez que aparece una ciudad. Cuando se agota el crédito la API devuelve **402** (falta cargar facturación) o **429** (tope de gasto propio) y **eso no es un bug**: el backend los propaga como un 429 con un mensaje claro en vez de confundirlo con un destino irresoluble.

El alojamiento sigue en el free tier de RapidAPI, que es **muy** chico. Ojo que el ciclo de RapidAPI se cuenta **desde el día de alta de la suscripción, no desde el 1° de cada mes**. Cada API tiene su cuota propia: que se agote la de alojamiento no afecta a la de vuelos.

Para desarrollar sin gastar nada existen `IGNAV_MOCK=true` (vuelos) y `RAPIDAPI_MOCK=true` (alojamiento, y vuelos si no se definió la anterior), que usan datos fixture.

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
├── .github/workflows/  # Pings programados que mantienen vivo el deploy
├── backend/            # API REST con NestJS — ver backend/README.md
│   ├── src/            # Módulos: auth, usuarios, viajes, itinerarios,
│   │                   # presupuestos, lugares, vuelos, alojamiento, mail,
│   │                   # planes (límites) y pagos (Mercado Pago)
│   ├── prisma/         # Schema y migraciones
│   ├── test/           # Tests e2e (los unitarios viven junto a cada service)
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/               # Documentación funcional: sistema de planes de uso
└── frontend/           # Aplicación web con Next.js — ver frontend/README.md
    ├── app/            # Rutas (App Router) + BFF proxy en app/api
    ├── components/     # UI por dominio (itinerario, mapa, reservas, …)
    ├── lib/            # Cliente de API, hooks de TanStack Query, tipos
    └── proxy.ts        # Guard de rutas (el ex middleware.ts de Next 15)
```

Cada subproyecto tiene su propio README con el detalle de arquitectura, variables de entorno y decisiones de diseño.

## Requisitos

- Node.js **20.19+ o 22.12+** (es lo que pide Prisma 7; el Dockerfile usa 22)
- PostgreSQL (o acceso a una instancia Supabase)
- npm / pnpm

## Instalación y Desarrollo

### Backend

```bash
cd backend
npm install
cp .env.example .env   # completar DATABASE_URL, JWT_SECRET y las API keys
npx prisma generate
npx prisma migrate deploy  # aplica las migraciones versionadas
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
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Servidor en modo producción (requiere `npm run build`) |
| `npm run seed` | Carga el catálogo de intereses (idempotente) |
| `npm run plan:asignar -- <email> <GRATIS\|BASE\|PREMIUM>` | Asigna un plan a mano, sin Mercado Pago y sin vencimiento (demos y cortesías) |
| `npm run test` | Tests unitarios (17 suites, 207 tests) |
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

## Deploy

La app se despliega en tres servicios gratuitos:

| Parte | Dónde | Qué tener en cuenta |
|---|---|---|
| Frontend (Next) | **Vercel**, plan Hobby | Siempre despierto. Root directory `frontend`. |
| Backend (NestJS) | **Render**, web service free | Se duerme a los 15 min sin uso y tarda ~1 min en despertar. Root directory `backend`, build por Dockerfile. |
| Base de datos | **Supabase**, plan free | La misma que en desarrollo. Se pausa sola a los 7 días sin actividad. |

**Orden**, porque cada lado necesita la URL del otro:

1. **Render** → New Web Service → el repo → Root Directory `backend`, runtime Docker, health check `/api/health`. Cargar las variables de entorno (ver [backend/README](backend/README.md#variables-de-entorno)) **sin** `PORT`, que la inyecta Render, y con `THROTTLE_LIMIT` más alto (por ejemplo `300`): el límite de peticiones se cuenta por IP y, como el frontend hace de intermediario, el backend ve siempre la IP de Vercel.
2. **Vercel** → New Project → el repo → Root Directory `frontend` → variable `BACKEND_URL=https://<servicio>.onrender.com/api`.
3. Volver a Render y completar `FRONTEND_URL=https://<proyecto>.vercel.app` y `MP_BACK_URL=https://<servicio>.onrender.com/api/pagos/volver`.
4. **Cargar `BREVO_API_KEY`**, o no se manda ningún email. Render bloquea los puertos SMTP en el plan free, así que las credenciales de Gmail no alcanzan: los envíos fallan con `ENETUNREACH` y sólo se ve en los logs, porque la app degrada en silencio a propósito. En Brevo alcanza con verificar la dirección de `MAIL_FROM` (no hace falta dominio propio) y esperar la aprobación manual que hacen en las cuentas nuevas.
5. En el panel de Mercado Pago, apuntar el webhook a `https://<servicio>.onrender.com/api/pagos/webhook`.

**Mercado Pago queda en modo de prueba.** Lo desplegado son las credenciales de la cuenta vendedora de prueba, así que **nadie puede pagar con dinero real**: para completar un pago hay que entrar al checkout con la cuenta compradora de prueba.

**Los pings ya están en el repo**, en `.github/workflows/`. Los dos pegan a `GET /api/health`, que no pasa por el límite de peticiones y hace `SELECT 1` contra la base:

| Workflow | Cada cuánto | Estado | Para qué |
|---|---|---|---|
| `mantener-base-viva.yml` | 3 días | Activo | Que Supabase no pause el proyecto por inactividad. Cuesta unas pocas horas de Render al mes. |
| `ping.yml` | 10 minutos | Apagado | Que no haya arranque en frío durante una demo. Se prende el día antes desde Actions y se apaga al terminar. |

Render da **750 horas gratis por mes compartidas entre todos los servicios** y un servicio despierto todo el mes gasta unas 720: por eso el ping frecuente queda apagado salvo alrededor de una presentación.

**Dar de baja:** borrar el servicio en Render y el proyecto en Vercel. La base se puede dejar, porque se pausa sola, o borrarla desde Supabase.

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
- [x] Planes de uso (Gratis / Base / Premium) con suscripción mensual vía Mercado Pago, límites aplicados en el backend y "Mi plan" en el perfil — ver [docs/PLANES.md](docs/PLANES.md)
- [x] Deploy gratuito: backend en Render, frontend en Vercel, base en Supabase y pings programados — ver [Deploy](#deploy)

## Futuras Mejoras

- Chatbot de viajes integrado
- Predicción y adaptación automática del itinerario según el clima
- Recomendaciones generadas con IA
- Compartir viajes entre usuarios
- Exportar itinerarios a PDF
- Versión móvil o PWA
- Sistema de favoritos y lugares guardados

## Autores

- **Santiago Purro**
- **Santiago Intili**

## Licencia

MIT © 2026 Santiago Purro & Santiago Intili
