# Smart Travel Planner — Backend

API REST del [Smart Travel Planner](../README.md), construida con NestJS 11 y Prisma 7 sobre PostgreSQL. Expone autenticación y gestión de cuenta (incluida recuperación de contraseña por email), perfil de viajero, gestión de viajes, generación/edición de itinerarios asistida por IA (Google Gemini), presupuesto automático, búsqueda de lugares/vuelos/alojamiento reales, y planes de uso con suscripción mensual de Mercado Pago. Empaquetado con Docker y cubierto por una suite de tests unitarios y e2e.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (Node.js / TypeScript, ESM) |
| Base de datos | PostgreSQL vía Prisma 7 con `@prisma/adapter-pg` (Supabase en prod, Postgres local en dev con Docker) |
| Auth | Passport + JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt |
| Email | Nodemailer + SMTP (Gmail) — mail de recuperación de contraseña |
| IA | Google Gemini (`@google/genai`) para generación de itinerarios |
| Lugares reales | Google Places API (New) — Text Search, para fundamentar los itinerarios en POIs verificados |
| Vuelos | [Ignav](https://ignav.com) — tarifas en vivo, `POST /api/fares/one-way` |
| Alojamiento | RapidAPI — Booking.com/`booking-com15` |
| Pagos | Mercado Pago — SDK oficial `mercadopago` (suscripciones `preapproval` + webhooks) |
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
| `IGNAV_API_KEY` | Sí | API key de [ignav.com](https://ignav.com) (cuenta gratis, sin tarjeta; hay que **verificar el mail** o la key responde 403 `email_not_verified`). Da **1.000 requests gratis por única vez** y después USD 2 cada 1.000, sin mínimo. Cada búsqueda consume 2 requests de tarifas; los aeropuertos se cachean en memoria. Sin crédito responde 402 y con el tope de gasto propio 429 — los dos se propagan como 429 (ver reglas de dominio). |
| `IGNAV_MOCK` | No | `"true"` para usar vuelos fixture sin gastar requests (útil en dev/demos). Si no está definida se cae a `RAPIDAPI_MOCK`. Default `"false"`. |
| `RAPIDAPI_KEY` | Sí | API key de RapidAPI, con suscripción (free tier) a "Booking COM" (`booking-com15`, alojamiento). El ciclo se cuenta desde el alta de la suscripción, no desde el 1° de cada mes. Agotada la cuota la API devuelve 429 (ver reglas de dominio). |
| `RAPIDAPI_MOCK` | No | `"true"` para usar datos fixture de alojamiento sin pegarle a RapidAPI (no gasta cuota; útil en dev/demos), y de vuelos si no se definió `IGNAV_MOCK`. Los hoteles fixture están **por ciudad** (hoy Mendoza y Córdoba, con coordenadas aproximadas); una ciudad sin fixture cae en Mendoza y avisa por log. Default `"false"`. |
| `SMTP_HOST` / `SMTP_PORT` | No | Servidor SMTP para el mail de recuperación de contraseña (Gmail: `smtp.gmail.com` / `465`). |
| `SMTP_USER` / `SMTP_PASS` | No* | Cuenta remitente y su **App Password** (Gmail requiere 2FA + App Password de 16 chars). *Requeridas para que `forgot-password` y el código de verificación funcionen; la app arranca sin ellas: el alta no se cae si el mail no sale, la cuenta queda sin verificar y el usuario puede pedir el código de nuevo. |
| `MAIL_FROM` | No | Dirección "De:" del mail (con Gmail, igual a `SMTP_USER`). |
| `PORT` | No | Puerto del servidor (default `3000`). |
| `THROTTLE_LIMIT` | No | Peticiones por minuto y **por IP** (default `60`). Detrás del BFF de Next todas llegan con la IP del frontend, así que desplegado todos los usuarios comparten el cupo: ahí conviene subirlo (ej. `300`). |
| `FRONTEND_URL` | No | Origen permitido por CORS y base del link de reseteo de contraseña (default `http://localhost:3001`). |
| `MP_ACCESS_TOKEN` | No* | Access Token de la aplicación de Mercado Pago (en desarrollo, el de la cuenta vendedora de prueba). *Sin él la app arranca y los pagos responden 503. |
| `MP_WEBHOOK_SECRET` | No* | Clave secreta de webhooks del panel de Mercado Pago, para validar la firma de las notificaciones. |
| `MP_BACK_URL` | No | Adónde vuelve el usuario después de pagar. Mercado Pago exige https: en desarrollo, `https://<túnel>/api/pagos/volver`. Sin definir, `FRONTEND_URL/planes/resultado`. |
| `MP_PAYER_EMAIL_PRUEBA` | No | Solo en pruebas: el email de la cuenta compradora de prueba, la única que puede pagar en el sandbox. En producción, sin definir. |
| `NODE_ENV` | No | `development` \| `production` \| `test`. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | No | Reservadas para una futura integración directa con el SDK de Supabase. Hoy la app solo usa `DATABASE_URL`; estas variables no se leen en el código. |

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo desarrollo (watch). |
| `npm run start:prod` | Servidor en modo producción (requiere `npm run build` antes). |
| `npm run build` | Compila a `dist/`. |
| `npm run seed` | Carga el catálogo de intereses turísticos en la base (idempotente). |
| `npm run plan:asignar -- <email> <GRATIS\|BASE\|PREMIUM>` | Asigna un plan a mano, sin Mercado Pago y sin vencimiento (desarrollo, demos, cortesías). Se niega si el usuario tiene una suscripción cobrada. |
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
| `auth` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/verificar-email`, `POST /api/auth/reenviar-verificacion`, `POST /api/auth/cambiar-email` | Registro/login con JWT (bcrypt, 7 días). Cambio de contraseña (autenticado) y recuperación por email (token SHA-256 con vencimiento de 1h). `forgot-password` responde **siempre** el mismo mensaje genérico —exista o no el email, y aunque falle el envío del mail—: si el fallo de SMTP devolviera 500, sólo lo haría para emails registrados y eso permitiría enumerar cuentas. El error queda en el log del servidor; si la dirección no tiene cuenta se le manda igual un mail avisándole, que sólo puede leer el dueño de la casilla. Al registrarse se envía un **código de 6 dígitos** (hasheado en la base, vence a las 24 h) y hasta confirmarlo el backend rechaza con 403 `EMAIL_NO_VERIFICADO` **todas** las acciones que consume el plan: crear viaje, generar/regenerar itinerario, buscar vuelos y alojamiento, optimizar. El login y la navegación siguen abiertos, así que la cuenta existe y puede pedir el código de nuevo, pero no puede hacer nada hasta confirmarlo. `cambiar-email` es la salida para quien se equivocó tipeando su dirección —reenviar no sirve, vuelve al mismo lado— y sólo funciona **mientras la cuenta no esté verificada**: cambiar el email de una ya confirmada es un vector de secuestro y necesitaría contraseña más aviso a la dirección vieja. Rate limit de 5 intentos/minuto en todas. |
| `usuarios` | `/api/usuarios/*` | Perfil propio, perfil de viajero (ritmo, presupuesto, tipo), catálogo e intereses del usuario, y **borrado de cuenta** (`DELETE /api/usuarios/me`, con confirmación de contraseña y cascade completo). |
| `viajes` | `/api/viajes/*` | CRUD de viajes, scopeado por usuario, con intereses específicos por viaje. `POST` crea el viaje en estado **`borrador`** (ver más abajo). `PATCH /api/viajes/:id` también cambia el `estado` (validado contra `dto/estados-viaje.ts`) y, si cambian las fechas, en la misma transacción **reajusta los días del itinerario** (recalcula sus fechas, borra los que sobran con sus actividades o crea días vacíos) y **recalcula el presupuesto**. |
| `itinerarios` | `/api/viajes/:idViaje/itinerario/*` | Generación de itinerario con IA (Gemini), consulta, y edición manual: agregar/editar/eliminar/mover actividades entre días, con historial de cambios (`GET .../cambios`). `POST .../dias/:idDia/optimizar` reordena las paradas del día por cercanía (nearest-neighbor + 2-opt) y corre los horarios a la nueva secuencia. `POST .../geocodificar` ubica por lotes las actividades sin coordenadas. |
| `presupuestos` | `GET /api/viajes/:idViaje/presupuesto` | Desglose por categoría + detalle de gastos, recalculado automáticamente al mutar el itinerario o al elegir vuelo/alojamiento. |
| `lugares` | `GET /api/lugares`, `GET /api/lugares/buscar` | `/buscar` trae lugares turísticos reales por destino (Google Places, con rating), cacheados en la tabla `lugares`; si un lugar ya existía (p. ej. creado por la IA), lo **refresca** con los datos de Places. `GET /api/lugares?q=&destino=` busca por texto entre los ya cacheados (una query, sin pegarle a Google) — es lo que usa el autocompletado, con `/buscar` de fallback. También expone el geocoding con Nominatim/OSM (sin API key). |
| `vuelos` | `/api/viajes/:idViaje/vuelos/*` | Busca opciones reales (Ignav, ida y vuelta combinadas) y las guarda en `opciones_vuelo` ordenadas por precio. `PATCH .../:idVuelo/seleccionar` elige una (exclusiva por viaje) y recalcula el presupuesto. |
| `alojamiento` | `/api/viajes/:idViaje/alojamiento/*` | Ídem con Booking.com, ordenadas por precio por noche. La búsqueda pide una habitación doble cada dos personas (`habitacionesPara`). `PATCH .../:idAlojamiento/seleccionar` elige una y suma `precio_por_noche × noches` al presupuesto. |

Todos los endpoints salvo `auth`, `health`, el catálogo `GET /api/planes` y los de `pagos` (webhook y vuelta del checkout) requieren `Authorization: Bearer <token>` (`JwtAuthGuard`). La estrategia JWT **verifica contra la base que el usuario siga existiendo**: el token de una cuenta borrada da 401 de inmediato, sin esperar a que venza.

### Cinco reglas de dominio que conviene conocer

- **Un viaje nace en `borrador`.** El frontend crea el viaje en el primer paso de su wizard porque los pasos siguientes (buscar vuelo y alojamiento) van scopeados a `:idViaje` y necesitan que exista. Mientras el wizard está en curso el viaje queda en `borrador`, y el frontend lo pasa a `planificado` con un `PATCH` cuando el usuario termina. `borrador` es un estado válido de `dto/estados-viaje.ts` como cualquier otro —la API no impide setearlo—, pero **el frontend no lo ofrece en el selector manual de estado**: volver a marcarlo dejaría al viaje atrapado en el wizard.
- **Un 429 de RapidAPI se propaga como 429.** Los clientes de vuelos y alojamiento degradan a `null`/`[]` ante cualquier error HTTP, lo que hacía que agotar la cuota se reportara como "No se pudo resolver el origen o destino": un mensaje que manda a buscar el problema en el destino. `common/rapidapi-cuota.ts` intercepta el 429 antes de ese degradado y lo convierte en un `HttpException` con un mensaje explícito. Se aplica en los cuatro puntos donde se le pega a RapidAPI (`searchAirport`, `searchFlights`, `searchDestination`, `searchHotels`).
- **El alojamiento no es una actividad del itinerario**, sino un costo del viaje. `alojamiento` no es un `tipo_actividad` válido (ver `itinerarios/dto/tipos-actividad.ts`); el usuario elige un hotel por viaje y de ahí sale `monto_alojamiento`. Se le pide a Gemini que no lo genere **y además se filtra al persistir**, porque el modelo ignora la instrucción con frecuencia.
- **Los precios ya vienen calculados para todo el grupo.** `OpcionVuelo.precio` es el total ida+vuelta (la búsqueda consulta la API con `cantidadPersonas` adultos) y `precio_por_noche` también está prorrateado. **No hay que multiplicar por la cantidad de personas.** Verificado contra la API de Booking: `grossPrice.value` es el total de la estadía completa (4 noches cuestan exactamente 4× lo que 1 noche), y `room_qty` no altera el precio de una propiedad — sólo cambia qué propiedades tienen disponibilidad.
- **La búsqueda de lugares está acotada a categorías turísticas.** `GET /api/lugares/buscar` consulta Google Places sólo por las 8 categorías de `CATEGORIAS_TURISTICAS` (museo, atracción turística, sitio histórico, monumento, parque, mirador, restaurante, café). Un POI que no cae en ninguna —por ejemplo un **estadio de fútbol**— no se cachea y por lo tanto **no aparece en el autocompletado por su nombre** (`GET /api/lugares?q=`), que sólo busca sobre lo ya cacheado. Ej.: buscando "kempes" en Córdoba aparece "Parque del Kempes" (entró como `parque`), pero no el "Estadio Mario Alberto Kempes". El usuario igual puede tipear el nombre completo y agregarlo como **texto libre**: la actividad se guarda sin `id_lugar` (sin rating ni categoría reales) y las coordenadas se resuelven después con Nominatim. Para incluir un tipo nuevo, agregarlo a `CATEGORIAS_TURISTICAS` en `lugares/lugares.service.ts`.

> Nota: los vuelos vienen de Ignav (tarifas en vivo) y el alojamiento de un mirror no oficial de Booking.com en RapidAPI — son informativos, no hay integración de reserva real. Para desarrollar sin gastar cuota, ver `IGNAV_MOCK` y `RAPIDAPI_MOCK`.

## Planes y pagos

Las reglas funcionales están en [docs/PLANES.md](../docs/PLANES.md). Acá, cómo está hecho y cómo probarlo.

**Límites.** Los números viven en `planes/planes.config.ts`: límites, precios en pesos, días de gracia y tope diario. Cada acción cara llama a `PlanesService.verificar` antes de gastar, y a `registrar` dentro de la transacción de la operación, así una acción que falla no consume. El plan vigente **se calcula al leer**, sin procesos programados: una suscripción cuyo `vigente_hasta` pasó cuenta como en gracia durante 3 días y después como vencida. Los rechazos tienen cuerpo propio, documentado en Swagger:

| `codigo` | Status | Cuándo |
|---|---|---|
| `LIMITE_PLAN` | 403 | El plan no incluye la acción o se agotó su límite. Trae `planSugerido` (el más barato que la permite) y `renuevaEl` si el límite es por período. |
| `TOPE_DIARIO` | 403 | Tope anti-abuso de 24 h, igual para todos los planes: subir de plan no lo levanta. |
| `BORRADOR_EXISTENTE` | 409 | Crear un viaje con otro en borrador. Trae `idViaje` para retomarlo. |

**Pagos.** `pagos/mercado-pago.service.ts` es lo único que conoce el SDK. Sin `MP_ACCESS_TOKEN` los pagos responden 503; si Mercado Pago falla, 502.

| Endpoint | Qué hace |
|---|---|
| `GET /api/planes` | Catálogo con límites y precios (público). |
| `GET /api/planes/mi-plan?idViaje=` | Plan vigente, período y uso (del período y, con `idViaje`, de ese viaje). |
| `POST /api/planes/suscribir` | Crea la suscripción en Mercado Pago (pendiente) y devuelve el `initPoint` del checkout. 409 si ya se cobra un plan igual o mayor. |
| `GET /api/planes/suscripciones/:id` | Estado de una suscripción propia. Si sigue pendiente, la sincroniza con Mercado Pago: la usa la página de retorno del pago. |
| `POST /api/planes/cancelar` | Cancela en Mercado Pago y después en la base; el plan sigue hasta el fin del período pagado. |
| `POST /api/pagos/webhook` | Notificaciones de Mercado Pago (público y sin límite por IP). |
| `GET /api/pagos/volver` | Redirige la vuelta del checkout al frontend (para desarrollo con túnel). |

Cómo se aplica un pago:

- **Solo activa lo que confirma la API de Mercado Pago.** El webhook valida la firma `x-signature` con el validador del SDK y después vuelve a pedir la suscripción y todos sus cobros: del cuerpo de la notificación solo se usan el tipo y el id. Sincronizar la suscripción entera hace que el orden y los duplicados no importen (`mp_payment_id` es único y cada cobro se aplica con la fila de la suscripción bloqueada).
- **El plan se activa con el primer cobro aprobado**, que fija el día ancla del período. Cada cobro aprobado extiende un período; uno rechazado pasa el plan a gracia.
- **Tres caminos llegan a esa misma sincronización:** el webhook, la página de retorno del checkout, y el **respaldo de las renovaciones**: `planVigente` consulta a Mercado Pago las suscripciones que llegaron al fin de lo pagado (hasta 30 días después, como mucho una vez cada 15 minutos por suscripción) antes de pasarlas a gracia.
- Subir de plan cancela la suscripción anterior recién cuando la nueva queda paga. Borrar la cuenta cancela antes todo lo que Mercado Pago pueda seguir cobrando; si no puede, no borra.

### Probar los pagos en desarrollo

1. En Mercado Pago, una aplicación de **Suscripciones** con dos cuentas de prueba, vendedora y compradora. `MP_ACCESS_TOKEN` es el de la vendedora y `MP_PAYER_EMAIL_PRUEBA` el email de la compradora.
2. Un túnel público al backend, con una de dos opciones:
   - **ngrok con dominio fijo** (`ngrok http --url=<dominio>.ngrok-free.dev 3000`), la que se usa **hasta tener un dominio propio**: la URL no cambia, así que el panel y `MP_BACK_URL` se configuran una sola vez. Mercado Pago **no** llega con los webhooks a los dominios gratuitos de ngrok —y en el sandbox tampoco avisa de los cobros reales a un dominio público, ver más abajo—, pero el plan igual se activa por la vuelta del checkout y las renovaciones las cubre el respaldo.
   - **cloudflared** (`cloudflared tunnel --url http://localhost:3000`), para probar los webhooks: sí los recibe, pero la URL cambia cada vez que se levanta y hay que actualizarla en el panel y en `MP_BACK_URL`.
   - **Con dominio propio se pasa a Cloudflare:** un túnel con nombre (`cloudflared tunnel create`) apuntando a un subdominio fijo, que recibe los webhooks y no cambia de URL. Con el backend desplegado en un servidor con ese dominio no hace falta túnel: el webhook apunta directo a `https://<dominio>/api/pagos/webhook`.
3. En el panel de Mercado Pago, Webhooks en modo de prueba: `https://<túnel>/api/pagos/webhook` con el evento "Planes y suscripciones", y la clave secreta en `MP_WEBHOOK_SECRET`. Con cloudflared, "Simular notificación" tiene que responder 200.
4. `MP_BACK_URL=https://<túnel>/api/pagos/volver`: Mercado Pago rechaza `http://localhost` como URL de retorno, y ese endpoint redirige al frontend.
5. Pagar desde `/planes` entrando al checkout **con la cuenta compradora** ("Ingresar con mi cuenta") y la tarjeta de prueba con titular `APRO`. Pagar "sin cuenta" en el sandbox termina en "No pudimos procesar tu pago".

Para probar un plan sin pagar: `npm run plan:asignar -- <email> <PLAN>`.

Particularidades de la API de Mercado Pago que conviene conocer:

- Las suscripciones de Argentina solo aceptan **ARS**, con un mínimo de $ 15.
- Para cancelar es `status: "cancelled"`, con dos L: `canceled` da 400.
- La búsqueda de cobros (`/authorized_payments/search`) acepta **como máximo 15** resultados por página.
- Agrega sus parámetros a la URL de retorno con `?` aunque ya tenga query (`?idSuscripcion=21?preapproval_id=...`).
- "Simular notificación" manda `type=subscription_authorized_payment` en la query y `subscription_preapproval` en el cuerpo, con un id falso. El webhook procesa los dos tipos e ignora lo que no existe (consultar como cobro un id que no tiene ese formato da 400, no 404).
- No avisa por webhook de los cambios hechos por la API con el propio token, y en el sandbox los cobros mensuales no se pueden disparar a pedido.
- **Con la app desplegada el webhook no necesita túnel**: apunta a la URL pública del backend (`https://<servicio>.onrender.com/api/pagos/webhook`), que no cambia. Ver [Deploy (Render)](#deploy-render).
- **Pero en el sandbox los cobros reales no avisan igual.** Con la app desplegada, el "Simular notificación" del panel llega y responde 200, pero dos pagos de verdad (18/09/2026) no generaron ninguna notificación. O sea que el túnel gratuito no era la única causa: no hay que asumir que el webhook va a llegar. El plan se activa por la vuelta del checkout y las renovaciones dependen del respaldo de reconciliación.

## Deploy (Render)

Corre como web service gratuito de Render, construido con el `Dockerfile` de esta carpeta: Root Directory `backend`, runtime Docker, health check `/api/health`. Lo que cambia respecto de desarrollo:

| Variable | Valor en el deploy |
|---|---|
| `PORT` | **No definirla.** Render la inyecta y `main.ts` la lee. |
| `FRONTEND_URL` | La URL de Vercel: origen de CORS y base del link de reseteo de contraseña. |
| `MP_BACK_URL` | `https://<servicio>.onrender.com/api/pagos/volver`. |
| `MP_ACCESS_TOKEN` / `MP_PAYER_EMAIL_PRUEBA` | Siguen siendo los de las cuentas de prueba: nadie puede pagar dinero real. |
| `IGNAV_MOCK` / `RAPIDAPI_MOCK` | `"false"`: datos reales de vuelos y alojamiento. Los vuelos ya no tienen cuota mensual (Ignav cobra por uso), pero el alojamiento sigue con el free tier de RapidAPI; con `"true"` se usan datos fixture y no se gasta nada. |
| `THROTTLE_LIMIT` | Conviene subirlo (ej. `300`): ver la nota sobre la IP, más abajo. |
| `NODE_ENV` | `production`. |

- **La base no se migra desde Render**: el schema ya está aplicado en Supabase. Si hiciera falta, `npx prisma migrate deploy` toma el `DATABASE_URL` del entorno (ver `prisma.config.ts`).
- **El servicio se duerme** a los 15 minutos sin tráfico y tarda ~1 minuto en despertar. Un webhook de Mercado Pago que llegue con el servicio dormido puede vencer; Mercado Pago reintenta y, además, está el respaldo de las renovaciones.
- **`/api/health` sirve de ping**: no pasa por el límite de peticiones y hace `SELECT 1`, así que mantiene despierto el servicio y evita que Supabase pause el proyecto.
- **Ojo con el límite de peticiones**: el throttler cuenta por minuto y **por IP**, y con el frontend en Vercel el backend ve la IP de Vercel, no la de cada usuario, así que todos comparten ese cupo. Por eso el límite se configura con `THROTTLE_LIMIT` en lugar de estar fijo en el código.

## Tests

```bash
npm test           # unitarios (~3s)
npm run test:e2e   # end-to-end (~90s, hace 1 llamada real a Gemini)
```

- **Unitarios** (17 suites, 207 tests): cada service aislado, mockeando Prisma y las APIs externas (Gemini/Google/RapidAPI/Mail) por inyección de dependencias; bcrypt/crypto corren reales. Cubren auth (register/login/cambio/forgot/reset, incluido que un fallo de envío del mail no cambie la respuesta genérica), la estrategia JWT (rechaza tokens de cuentas borradas), borrado de cuenta con cascade, IDOR y edición de viajes (validación del rango de fechas, reajuste de los días del itinerario, recálculo del presupuesto), matemática del presupuesto (incluidos vuelo y alojamiento elegidos), ranking y selección de vuelos/alojamiento, el cacheo/refresco y la búsqueda por texto de lugares, la optimización de recorrido por día (nearest-neighbor + 2-opt), los guards de itinerarios, el motor de planes (plan vigente, períodos anclados al día del pago, límites y tope diario) y los pagos (suscribir, cancelar, firma del webhook, idempotencia, cobros rechazados, subida de plan y respaldo de renovaciones).
- **E2E** (`test/main-flow.e2e-spec.ts`): bootstrapea la `AppModule` real y recorre el flujo completo **contra la base configurada en `.env`** con **Gemini real**, `IGNAV_MOCK=true` y `RAPIDAPI_MOCK=true`: registro → login → crear viaje (y 409 con un borrador abierto) → generar itinerario con IA → presupuesto → límite del plan Gratis (403) → endpoints de pagos que no llaman a Mercado Pago (validación, 404, webhook con firma inválida, vuelta del checkout) → vuelos/alojamiento → IDOR 403. Crea y borra sus propios usuarios (se autolimpia).

## Base de datos

El schema de Prisma (`prisma/schema.prisma`) modela usuarios, perfil de viajero, intereses, viajes, itinerarios, días, lugares, actividades, presupuesto, gastos, opciones de vuelo/alojamiento, y las suscripciones, pagos y consumos de los planes. El cliente generado va a `generated/prisma` (gitignoreado, se regenera con `npx prisma generate`).

Conviven dos flujos, según el entorno:

- **Local y Docker**: `npx prisma db push` sincroniza el schema directamente contra la base. Es lo que corre el `docker-compose` al arrancar.
- **Supabase**: la base está versionada con las migraciones de `prisma/migrations/`, que se aplican con `npx prisma migrate deploy`. Nunca uses `migrate dev` contra Supabase: ante una divergencia ofrece resetear la base.

> Nota: el schema usa `onDelete: NoAction` en todas las relaciones — los borrados en cascada (viaje → itinerario → días → actividades, etc., y usuario → viajes/perfil/intereses) se manejan explícitamente en los services dentro de transacciones, no a nivel de base de datos.

## Estado del proyecto

Backend **funcionalmente completo**: autenticación y gestión de cuenta, perfil de viajero, viajes, itinerarios con IA y edición manual, presupuesto automático, lugares reales, vuelos y alojamiento, planes de uso con suscripción de Mercado Pago, más hardening (validación de env, rate limiting, transacciones, health check), suite de tests y empaquetado con Docker.
