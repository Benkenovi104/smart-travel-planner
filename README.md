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
2. Creación del viaje (destino, fechas, personas, presupuesto, intereses específicos)
3. Consulta de servicios externos (lugares, vuelos, alojamiento)
4. Generación automática del itinerario por días
5. Optimización de actividades (minimizar traslados, horarios, costos)
6. Edición manual por el usuario
7. Reoptimización tras los cambios
```

## Perfil de Viajero e Intereses

El sistema maneja dos niveles de preferencias:

**Intereses generales del usuario** (permanentes en el perfil):
gastronomía, cultura, naturaleza, historia, aventura, vida nocturna, etc.

**Intereses específicos del viaje** (por cada viaje creado):
Un usuario con intereses generales en gastronomía y cultura puede priorizar nieve y trekking para un viaje a Bariloche, y teatro y museos para uno a Buenos Aires.

## Funcionalidades Principales

| Funcionalidad | Descripción |
|---|---|
| Generación de itinerarios | Plan completo por días según destino, fechas, presupuesto e intereses |
| Recomendaciones personalizadas | Combina perfil general + intereses del viaje + características del destino |
| Optimización de rutas | Organiza actividades minimizando tiempos de traslado (heurísticas tipo TSP) |
| Visualización en mapa | Lugares, rutas y distribución geográfica del itinerario |
| Estimación de presupuesto | Desglose por vuelos, alojamiento, comidas, transporte y actividades |
| Vuelos y alojamiento | Consulta de opciones vía APIs externas (sin reserva real) |
| Edición del itinerario | Agregar, eliminar, mover y reordenar actividades manualmente |
| Guardado de viajes | Acceso futuro, edición posterior y reutilización de preferencias |

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

### Historial (opcional)
- `cambios_itinerario` — Registro de modificaciones del usuario (trazabilidad y recuperación de versiones)

## APIs y Servicios Externos

| Categoría | Opciones contempladas |
|---|---|
| Lugares y mapas | Google Places, Google Maps, Mapbox, OpenStreetMap, OpenTripMap |
| Vuelos | Amadeus, Kiwi, Skyscanner (sandbox/trial) |
| Alojamiento | RapidAPI, APIs de hoteles con acceso de prueba |

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | NestJS 11 (Node.js / TypeScript) |
| **Frontend** | Next.js 16 (React 19 / TypeScript) |
| **Base de datos** | PostgreSQL + Prisma ORM |
| **BaaS / Auth** | Supabase |
| **Estilos** | TailwindCSS 4 |
| **Mapas** | Mapbox / Google Maps / OpenStreetMap |

## Estructura del Proyecto

```
smart-travel-planner/
├── backend/        # API REST con NestJS
│   ├── src/        # Código fuente (módulos, controladores, servicios)
│   ├── prisma/     # Schema y migraciones de base de datos
│   └── test/       # Tests unitarios y E2E
├── frontend/       # Aplicación web con Next.js (App Router)
│   └── app/        # Páginas y layouts
├── docker/         # Configuración Docker (pendiente)
└── docs/           # Documentación (pendiente)
```

## Requisitos

- Node.js 20+
- PostgreSQL (o acceso a una instancia Supabase)
- npm / pnpm

## Instalación y Desarrollo

### Backend

```bash
cd backend
npm install
# Configurar variables de entorno
cp .env.example .env   # Completar DATABASE_URL y credenciales de Supabase
npx prisma migrate dev
npm run start:dev
```

El servidor arranca en `http://localhost:3000` por defecto.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación arranca en `http://localhost:3001` (o el puerto que indique Next.js).

## Scripts Disponibles

### Backend

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Servidor en modo desarrollo (watch) |
| `npm run start:prod` | Servidor en modo producción |
| `npm run test` | Tests unitarios |
| `npm run test:e2e` | Tests end-to-end |
| `npm run lint` | Análisis estático de código |

### Frontend

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Análisis estático de código |

## Alcance — Primera Versión

- [x] Estructura base backend (NestJS)
- [x] Estructura base frontend (Next.js + App Router)
- [x] Integración Prisma configurada
- [x] Integración Supabase configurada
- [ ] Modelos de datos y migraciones
- [ ] Registro e inicio de sesión
- [ ] Perfil de viajero e intereses generales
- [ ] Creación de viajes con intereses específicos
- [ ] Consulta de lugares turísticos desde APIs
- [ ] Generación automática del itinerario por días
- [ ] Visualización en mapa
- [ ] Optimización de actividades
- [ ] Estimación de presupuesto
- [ ] Sugerencia de vuelos y alojamiento (sin reserva real)
- [ ] Edición manual del itinerario
- [ ] Endpoints de API
- [ ] Componentes de UI
- [ ] Configuración Docker
- [ ] Documentación de API

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
