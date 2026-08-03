# Smart Travel Planner — Frontend

Aplicación web del [Smart Travel Planner](../README.md), construida con Next.js 16 (App Router) y React 19. Consume el [backend NestJS](../backend/README.md) a través de un **proxy BFF** propio, de modo que el JWT nunca queda accesible al JavaScript del navegador.

Cubre el flujo completo: registro e inicio de sesión, perfil de viajero, creación guiada por pasos y edición de viajes, generación del itinerario con IA, edición manual con drag & drop y búsqueda de lugares reales, mapa, presupuesto, y selección de vuelo y alojamiento.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) / React 19 / TypeScript |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Estado del servidor | TanStack Query v5 |
| Formularios | React Hook Form + Zod |
| Mapas | Leaflet + OpenStreetMap (sin API key) |
| Drag & drop | `@dnd-kit` |
| Notificaciones | `sonner` |
| Íconos | `lucide-react` |

> ⚠️ **Next.js 16 tiene breaking changes.** `middleware.ts` pasó a llamarse `proxy.ts`; `cookies()` y `headers()` son asíncronas; `params` y `searchParams` son `Promise`; la prop de reintento de `error.tsx` es `unstable_retry`, no `reset`; y `next lint` fue eliminado (se usa `eslint` directo). Ante la duda, leé `node_modules/next/dist/docs/` antes de escribir código.

## Instalación

```bash
npm install
cp .env.example .env.local   # o crealo a mano, ver abajo
npm run dev
```

Arranca en `http://localhost:3001`. Necesita el backend corriendo en `http://localhost:3000`.

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `BACKEND_URL` | Sí | URL base del backend, incluyendo el prefijo `/api` (ej. `http://localhost:3000/api`). Solo se lee del lado del servidor. |
| `AUTH_COOKIE_NAME` | No | Nombre de la cookie de sesión (default `stp_token`). |

No hay variables `NEXT_PUBLIC_*`: el navegador nunca habla directo con el backend.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3001. |
| `npm run build` | Build de producción. |
| `npm run start` | Sirve el build en el puerto 3001. |
| `npm run lint` | ESLint (flat config). |
| `npx tsc --noEmit` | Chequeo de tipos. |

## Arquitectura: el BFF proxy

El JavaScript del navegador no puede leer una cookie `httpOnly`, así que no puede armar el header `Authorization: Bearer` por su cuenta. La solución es que Next actúe de intermediario:

```
Navegador (TanStack Query)  ──fetch same-origin──►  Route Handlers de Next (/api/*)
       (la cookie httpOnly viaja sola)                        │
                                                              │ lee la cookie y agrega
                                                              │ Authorization: Bearer
                                                              ▼
                                                     Backend NestJS (:3000/api)
```

- **Login y registro**: un Route Handler dedicado recibe las credenciales, llama al backend y guarda el `access_token` en una cookie `httpOnly`. El token nunca toca el JS del cliente.
- **Todo lo demás**: TanStack Query pega a `/api/...` (mismo origen) y el catch-all `app/api/[...path]/route.ts` reenvía al backend con el Bearer de la cookie.
- **Logout**: un Route Handler borra la cookie. El backend es stateless y no revoca JWTs.
- **`proxy.ts`** (el ex `middleware.ts`): guard optimista de rutas. Sin cookie en una ruta privada, redirige a `/login`; con cookie en una ruta de auth, al dashboard. Es UX, no seguridad — la validación real la hace el backend en cada request.

## Estructura

```
frontend/
├── app/
│   ├── (auth)/              # grupo público: login, register, forgot/reset password
│   ├── (app)/               # grupo privado: dashboard, viajes, perfil
│   │   └── viajes/
│   │       ├── nuevo/       # wizard paso 1 — crea el viaje (queda en borrador)
│   │       └── [id]/
│   │           ├── crear/   # wizard pasos 2-4 (?paso=N): vuelo, alojamiento, resumen
│   │           └── page.tsx # detalle con pestañas (redirige al wizard si es borrador)
│   ├── api/                 # BFF: route handlers de auth + proxy genérico
│   ├── error.tsx            # boundary de errores de ruta
│   ├── global-error.tsx     # boundary del root layout
│   ├── not-found.tsx
│   └── providers.tsx        # TanStack Query + manejo global de 401
├── components/
│   ├── ui/                  # shadcn
│   ├── itinerario/          # vista, edición y drag & drop
│   ├── mapa/                # Leaflet (dynamic, ssr:false)
│   ├── presupuesto/
│   ├── reservas/            # vuelos y alojamiento
│   ├── perfil/
│   └── viajes/
├── lib/
│   ├── api/                 # cliente tipado por recurso + normalización
│   ├── query/               # query keys y hooks de TanStack Query
│   └── types/               # `api.ts` (shape crudo) y `models.ts` (dominio)
└── proxy.ts
```

## Decisiones que conviene conocer

**Normalización de tipos.** El backend serializa con naming mixto (Prisma devuelve el nombre del campo del modelo, no el de la columna) y los `Decimal` viajan como `string`. Por eso `lib/types/api.ts` describe el shape crudo y `lib/api/normalize.ts` lo convierte a los modelos limpios de `lib/types/models.ts`. Los componentes solo ven modelos normalizados.

**Invalidación cruzada.** El backend recalcula el presupuesto cuando se toca el itinerario, cuando se elige un vuelo/alojamiento y cuando se editan las fechas de un viaje (el alojamiento se cobra por noche). Los hooks invalidan `presupuesto` en esas mutaciones.

**Autocompletado de lugares (dos niveles).** Al escribir, el autocompletado pega primero a `GET /lugares?q=` (búsqueda por texto sobre lo ya cacheado, una query barata, con debounce). Sólo si ese endpoint vuelve vacío —un destino nunca buscado— cae al fallback `GET /lugares/buscar`, que dispara ocho búsquedas a Google Places (2-4s) y deja todo cacheado para la próxima. Al elegir un lugar se manda `id_lugar`, así la actividad nace con coordenadas, categoría y rating reales en vez de depender del geocoding por nombre. Ojo: sólo cachea **categorías turísticas** (museos, atracciones, parques, restaurantes…), así que un POI fuera de esas categorías —un estadio, por ejemplo— no aparece por su nombre; el usuario lo puede tipear igual y se guarda como texto libre. Ver la nota de dominio en el README del backend.

**Wizard de creación (4 pasos).** El paso 1 vive en `/viajes/nuevo` y **crea el viaje**; los pasos 2 a 4 en `/viajes/[id]/crear?paso=N`. Esa partición no es estética: buscar vuelos y alojamiento pega a endpoints scopeados a `:idViaje`, así que el viaje tiene que existir antes del paso 2. Por eso el wizard no junta todo y crea al final, sino que **crea primero y configura después**.

- El viaje nace en estado `borrador`. Los tres accesos a un borrador llevan al wizard: la card del dashboard linkea directo, y `/viajes/[id]` redirige si alguien entra por URL (mostrando el skeleton para no dejar ver el detalle a medio armar un frame). Al terminar, un `PATCH` lo pasa a `planificado` y cae en el detalle con pestañas.
- Los pasos 2 y 3 **reusan `VuelosSection` y `AlojamientoSection` sin modificarlas** — ya eran autocontenidas (`{ idViaje }`), así que los mismos componentes sirven al wizard y a las pestañas del detalle.
- La navegación entre pasos usa `router.push`, para que el botón "Atrás" del navegador recorra los pasos igual que el de la UI.
- El paso 4 se puede cerrar con "Generar itinerario" o con "Terminar por ahora": generar tarda ~1 min y consume cuota de Gemini, así que no puede ser la única salida.
- `borrador` está fuera de `ESTADOS_VIAJE_MANUALES` (`components/viajes/estado-badge.tsx`), la lista que alimenta el selector de estado. Si se pudiera marcar a mano, el viaje quedaría atrapado en el wizard.

**Formularios compartidos.** El formulario de viaje vive en `components/viajes/viaje-form.tsx` (schema, campos y `useViajeForm`) y lo usan tanto el paso 1 del wizard como el diálogo de edición. Radix desmonta el contenido de un `Dialog` al cerrarlo, así que el formulario se remonta con los valores del viaje y no hay que resetearlo a mano.

**Manejo global de 401.** Un 401 en una *query* significa sesión vencida: `QueryCache.onError` limpia la caché y manda a `/login`. Va **solo en las queries, nunca en las mutaciones**, porque el backend usa 401 también para "la contraseña actual es incorrecta" (al cambiar la contraseña o borrar la cuenta) y ahí expulsar al usuario sería un bug.

**Recuperación de contraseña.** `/forgot-password` muestra siempre la misma pantalla exista o no el email, e incluso si el envío del mail falla: el backend responde genérico a propósito para no revelar qué cuentas están registradas.

**Dark mode y controles nativos.** La app es dark-only (`:root` en `app/globals.css` ya trae la paleta oscura). Eso obliga a declarar `color-scheme: dark`: sin esa línea el navegador asume fondo claro y dibuja los controles nativos —ícono del calendario de los `input[type=date]`, flechitas de los `number`, scrollbars, el popup del date picker— con glifos oscuros pensados para fondo blanco, que quedan invisibles. Es preferible a invertir el ícono con `filter`, que no alcanza al popup ni a las scrollbars.

**Responsive y anchos mínimos.** El desborde horizontal en mobile casi siempre viene del mismo lado: los flex/grid items tienen `min-width: auto` y **no bajan del ancho de su contenido**, así que un `truncate` no hace nada si el contenedor de arriba no puede encoger. Por eso la card del dashboard lleva `min-w-0` en el `<a>` (que es el grid item) además de en el texto que trunca. El caso inverso también existe: en el encabezado de cada día del itinerario el título **no** lleva `min-w-0` a propósito, porque su ancho mínimo es justo lo que fuerza a las acciones a bajar de línea en vez de aplastarse.

**Mapa.** Leaflet se carga con `dynamic(..., { ssr: false })` porque no puede renderizar en el servidor. Las actividades sin coordenadas se pueden ubicar a posteriori con Nominatim desde el propio mapa, y el alojamiento elegido aparece como un pin fijo visible en todos los días.

## Estado

Fases 0 a 7 completas: auth, dashboard, creación guiada en 4 pasos, edición del viaje y de su estado, itinerario generado y editable, autocompletado de lugares reales, optimización de recorrido por día, mapa, presupuesto, vuelos y alojamiento, gestión de cuenta, errores globales y responsive.

El backlog de mejoras futuras (CI, deploy, tests de frontend, etc.) vive en `EXTRAS.md` en la raíz del repo (documento vivo, no versionado).
