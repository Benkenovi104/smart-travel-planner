# Extras — ideas y deuda técnica

> Backlog de mejoras a futuro (las fases 0-7 del frontend y del backend ya están
> completas). Nada de lo que está acá bloquea el uso de la app.
>
> El ítem 1 (optimización de recorridos / TSP) ya se implementó — se dejó acá como
> registro. Documento vivo. Última revisión: 2026-07-10.

Ordenado por lo que aporta, no por lo que cuesta. El esfuerzo es una estimación gruesa.

| # | Qué | Por qué importa | Esfuerzo |
|---|---|---|---|
| 1 | [Optimización de recorridos](#1-optimización-de-recorridos-tsp) | Es lo único algorítmico del proyecto y lo que el README promete | Medio |
| 2 | [CI en GitHub Actions](#2-ci-nadie-corre-los-tests) | Hay 49 tests que nadie ejecuta | Bajo |
| 3 | [Deploy](#3-deploy-el-proyecto-no-existe-fuera-de-tu-máquina) | Un link que se abre cambia cómo se percibe el trabajo | Bajo/Medio |
| 4 | [Deshacer la regeneración del itinerario](#4-regenerar-el-itinerario-es-destructivo) | Hoy se pierden todas las ediciones manuales | Medio |
| 5 | [Invalidar tokens al cambiar la contraseña](#5-cambiar-la-contraseña-no-echa-a-las-sesiones-viejas) | Agujero de seguridad real, arreglo de una línea | Bajo |
| 6 | [Tests del frontend](#6-el-frontend-no-tiene-un-solo-test) | `normalize.ts` es la capa más frágil y no está cubierta | Bajo |
| 7 | [Observabilidad](#7-observabilidad) | Sin esto, en producción no te enterás de nada | Bajo |
| 8 | [Detalles varios](#8-detalles-que-anoté-en-el-camino) | Cosas chicas que conviene no olvidar | Bajo |

---

## 1. Optimización de recorridos (TSP)

**El caso.** Es lo que le da sentido al nombre *Smart* Travel Planner. Todo lo demás del
proyecto es CRUD, integraciones con APIs y un prompt bien escrito; esto es lo único
genuinamente algorítmico. El README raíz lo lista en los objetivos y hoy **no existe**: el
orden de las actividades dentro de cada día lo decide Gemini al generar el itinerario, y el
usuario lo ajusta a mano con el drag & drop.

**Por qué ahora es barato.** Ya está construida toda la infraestructura que necesita:

- Las actividades tienen `lat`/`lng` (de Google Places, o del geocoding con Nominatim).
- El mapa ya dibuja polilíneas por día, así que la mejora **se ve**.
- El drag & drop ya existe, así que el usuario puede corregir el resultado.

**Qué hacer.**

- Backend: `POST /api/viajes/:idViaje/itinerario/optimizar`. Vecino más cercano para armar
  una ruta inicial, después 2-opt para desarmar los cruces. Son ~50 líneas y no necesita
  ninguna API externa: la distancia se calcula con haversine entre coordenadas.
- Reordena **dentro de cada día**, nunca cruza días (mover una actividad de día cambia el
  plan del usuario, no lo optimiza).
- Respetar las actividades con hora fija: si tienen `hora_inicio_estimada`, son anclas y no
  se mueven. Optimizar solo los huecos entre anclas.
- Ignorar las actividades sin coordenadas (dejarlas al final del día, en su orden actual).
- Registrar el cambio en `cambios_itinerario`, igual que las ediciones manuales.
- Devolver la distancia antes y después.

**Frontend.** Un botón "Optimizar recorrido" en el tab del itinerario o del mapa, y un
cartel con la mejora: *"Reordenamos el día 2: 14 km menos de traslados"*. Si la mejora es
cero, decirlo en vez de fingir que hizo algo.

**Cómo testearlo.** Es de lo más fácil de testear del proyecto: la distancia total después
de optimizar **nunca** puede ser mayor que antes. Un test con cuatro puntos en cuadrado y
un orden inicial cruzado (que 2-opt tiene que desarmar) alcanza para demostrar que funciona.

**Trampas.**

- La distancia en línea recta no es la distancia caminando. Está bien para un proyecto
  académico; decilo explícitamente en vez de que te lo señalen.
- Un día con menos de 4 actividades no tiene nada que optimizar. Cortar temprano.
- El presupuesto **no** cambia al reordenar: no hay que invalidarlo.

---

## 2. CI: nadie corre los tests

Hay 49 tests unitarios que pasan y **ninguna automatización los ejecuta**. No es teórico:
durante la fase 5 aparecieron dos cosas rotas desde hacía fases, y ninguna se había notado
porque nadie las corría.

- `itinerarios.service.spec.ts` fallaba desde la fase 3 (le faltaba proveer `GeocodingService`).
- `next build` fallaba por un `useSearchParams()` sin `Suspense` en `/login`, que en modo
  desarrollo no da error. O sea: el frontend **no compilaba en producción** y no lo sabíamos.

Un workflow de GitHub Actions que corra, en cada push y PR:

```
backend:   npm ci && npm test
frontend:  npm ci && npx tsc --noEmit && npx eslint . && npx next build
```

No incluir `npm run test:e2e` en el CI: hace una llamada real a Gemini y pega contra la base
de `.env`. Ese se corre a mano.

Opcional: un `coverageThreshold` en la config de Jest (vive en `backend/package.json`, hoy no
tiene ninguno) para que la cobertura no baje sin que nadie se entere.

---

## 3. Deploy: el proyecto no existe fuera de tu máquina

Hoy solo corre en local. Estás a un paso: la base ya está en Supabase y el backend ya tiene
`Dockerfile`.

- **Frontend → Vercel.** Casi sin configurar. ⚠️ `BACKEND_URL` va como variable de entorno
  del **servidor**, nunca como `NEXT_PUBLIC_`: si la exponés al cliente, se filtra la URL del
  backend y el patrón BFF pierde sentido.
- **Backend → Render o Fly.io**, con la imagen que ya existe. Pasarle `DATABASE_URL` de
  Supabase por variable de entorno; la imagen es agnóstica de la base.

**Lo que se va a romper y conviene anticipar:**

- La cookie ya usa `secure: NODE_ENV === 'production'` y `sameSite: 'lax'`, que es correcto
  porque el navegador solo habla con Next (mismo origen), nunca con el backend.
- Por la misma razón, **el `enableCors()` del backend hoy es casi decorativo**: ningún
  navegador le pega directo, solo lo hace el BFF de Next desde el servidor. No lo saques,
  pero no esperes que sea lo que te falle.
- Las variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` del
  `.env` **no se leen en ningún lado** del código. O se usan, o se borran.
- El free tier de Render duerme el servicio: la primera request después de un rato tarda
  ~30s, y generar un itinerario ya tarda bastante. Vale la pena un mensaje de carga honesto.

---

## 4. Regenerar el itinerario es destructivo

`POST /api/viajes/:id/itinerario/generar` borra todo y lo rehace: se pierden las ediciones
manuales. Hay un diálogo de confirmación, pero no hay vuelta atrás.

La tabla `cambios_itinerario` ya existe y hoy se usa **solo como log de lectura**. Con poco
más se puede guardar un snapshot del itinerario antes de regenerar y ofrecer un "deshacer".

Es de las features que más se notan usando la app: hoy, si tocaste veinte actividades y
apretás Regenerar por error, perdiste el trabajo.

Alternativa más barata si el snapshot completo resulta pesado: no borrar el itinerario viejo,
marcarlo como inactivo (`itinerarios` tiene una fila por viaje, habría que relajar el
`@unique` en `id_viaje`).

---

## 5. Cambiar la contraseña no echa a las sesiones viejas

El JWT es stateless y dura 7 días. Si alguien te robó la sesión, **cambiar la contraseña no
lo desconecta**: su token sigue siendo válido hasta que venza.

El arreglo estándar es barato:

1. Agregar `password_changed_at` a `usuarios` (migración aditiva).
2. Escribirlo en `changePassword` y en `resetPassword`.
3. En `JwtStrategy.validate()`, comparar el `iat` del token contra ese timestamp y rechazar
   los emitidos antes.

Lo bueno es que `validate()` **ya consulta la base** (se endureció en la fase 5 para rechazar
tokens de cuentas borradas), así que esto no agrega ninguna query. Es sumar un `select` y una
comparación.

Relacionado, más chico: la contraseña solo valida `min 8`. Se le puede pedir algo más, o
chequear contra la lista de contraseñas filtradas de Have I Been Pwned (tiene una API con
k-anonymity, no le mandás la contraseña).

---

## 6. El frontend no tiene un solo test

No hace falta testear componentes. Lo que sí conviene cubrir es la lógica pura, donde está el
riesgo real:

- **`lib/api/normalize.ts`** es la capa que traduce el naming mixto del backend (Prisma
  devuelve el nombre del campo del modelo, no el de la columna) y convierte los `Decimal`
  que viajan como `string` a números. Si el backend renombra un campo, hoy te enterás en
  runtime, con un `undefined` en pantalla.
- **`lib/format.ts`**: `diasEntre`, `formatHora`, `formatMoney`.
- El cálculo del total por día en el itinerario (excluye las actividades canceladas).

Vitest más unos pocos casos y ya estás cubierto. Un test de `normalizeViaje` con un objeto
crudo del backend hubiera evitado más de un dolor de cabeza.

Más adelante, si el proyecto crece: un e2e con Playwright del camino feliz
(registro → crear viaje → generar itinerario → verlo en el mapa).

---

## 7. Observabilidad

Solo está el `Logger` de Nest, que escribe a stdout. Para el alcance actual alcanza, pero en
cuanto lo despliegues vas a querer saber cuándo Gemini falla, cuándo RapidAPI devuelve 429 y
cuándo alguien recibe un 500.

Sentry tiene tier gratuito y se instala en minutos, en los dos lados. El `error.digest` que
`error.tsx` ya muestra en pantalla es exactamente lo que sirve para cruzar el error que vio
el usuario con el stack trace del servidor.

---

## 8. Detalles que anoté en el camino

**Costo de Gemini.** Generar un itinerario cuesta plata y no tiene rate limit propio (solo el
global de 60 req/min). Si esto queda expuesto en internet, alguien puede apretar "Regenerar"
en loop. Un `@Throttle` específico en `generar` es una línea.

**Nominatim.** Su política de uso pide como máximo 1 request por segundo. El backfill de
geocoding manda **lotes de 3 en paralelo** con una pausa de 1s entre lotes
(`itinerarios.service.ts`), o sea 3 requests simultáneas. Funciona, pero técnicamente viola la
política. Ir de a uno con 1s de pausa es más lento y más correcto.

**Estado del viaje.** Hoy `planificado` / `en curso` / `completado` no cambia nunca. Podría
derivarse de las fechas automáticamente, en vez de (o además de) editarse a mano.

**Horarios superpuestos.** Nada impide crear dos actividades el mismo día de 10:00 a 12:00.
Se quitó a propósito la validación de `hora_fin > hora_inicio` para permitir actividades
nocturnas que cruzan medianoche, así que cualquier validación nueva tiene que contemplar ese
caso.

**Zona horaria.** Ya nos mordió dos veces (las horas de actividad se guardaban con +3h; el
token de reseteo comparado contra `now()`). Las columnas son `timestamp`/`time` **sin** zona.
Vale un test de regresión que guarde y lea una hora, para que no vuelva a pasar.

**Docker.** Solo el backend está containerizado. Un `docker-compose` en la raíz que levante
base + backend + frontend haría que el proyecto arranque con un comando.

**Paginación e índices.** `GET /viajes` trae todo sin paginar y las claves foráneas no tienen
índices. Es correcto señalarlo y es irrelevante con la cantidad de datos que va a manejar
esto. No lo haría hasta tener un problema real.

**Lo que decidí no recomendar.** Accesibilidad e internacionalización son valiosas en
abstracto, pero en un proyecto en español para una defensa académica no mueven la aguja. Un
caché de las respuestas de Gemini tampoco: regenerar el mismo viaje no es un caso frecuente.

---

## Si hay que elegir una sola

La **optimización de recorridos**. Es lo único de esta lista que hace al proyecto *distinto*
en vez de *más prolijo*. El CI y el deploy son importantes, pero son higiene; esto es
producto, es lo que el README viene prometiendo desde el día uno, y toda la infraestructura
que necesita ya está construida.
