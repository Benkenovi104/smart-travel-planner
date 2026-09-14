# Planes de uso

> **Estado: implementado.** Este documento define cómo funciona el sistema de planes. El detalle técnico (endpoints, variables de entorno, cómo probar los pagos) está en el [README del backend](../backend/README.md#planes-y-pagos).

Smart Travel Planner ofrece tres planes: **Gratis**, **Base** y **Premium**. Los dos
pagos se cobran con una suscripción mensual de **Mercado Pago** que se renueva sola.

## Por qué los límites son los que son

Crear un viaje no le cuesta nada a la app. Lo que cuesta es lo que se hace **adentro** de
cada viaje, porque pega contra servicios externos que se pagan o tienen cuota:

| Acción | Qué consume |
|---|---|
| Generar o regenerar el itinerario | Una llamada a Gemini (~45 s) |
| Buscar vuelos | 4 requests de Sky Scrapper (RapidAPI) |
| Buscar alojamiento | 2 requests de Booking (RapidAPI) + ~5 de Google Places + 1 de Gemini |
| Editar, ver el mapa, ver el presupuesto, optimizar | Nada: es cómputo propio |

Por eso los planes limitan **dos cosas**: cuántos viajes se crean por período, y cuántas
veces se repiten las acciones caras dentro de cada viaje. Limitar solo los viajes no
alcanza: un usuario gratis que regenera 40 veces su único itinerario cuesta más que uno
del plan Base con cinco viajes.

La idea de cada plan:

- **Gratis** deja probar lo mejor de la app **una vez**: un viaje con su itinerario hecho por
  IA. Lo que no puede es repetir ni usar lo avanzado. Si el plan gratis no mostrara el
  itinerario generado, nadie entendería por qué pagar.
- **Base** agrega la optimización de recorridos y la búsqueda de vuelos, con límites.
- **Premium** tiene acceso a todo.

## Los tres planes

| | Gratis | Base | Premium |
|---|---|---|---|
| **Precio mensual** | $ 0 | $ 12.500 (≈ US$ 8) | $ 38.500 (≈ US$ 25) |
| **Viajes por período** | 1 | 5 | Sin límite |
| **Generar itinerario con IA** | 1 vez por viaje | ✓ | ✓ |
| **Regenerar itinerario** | ✗ | 3 por viaje | Sin límite |
| **Editar, mapa y presupuesto** | ✓ | ✓ | ✓ |
| **Optimizar recorrido** | ✗ | ✓ | ✓ |
| **Buscar alojamiento** | 1 por viaje | 3 por viaje | Sin límite |
| **Buscar vuelos** | ✗ | 1 por viaje | 3 por viaje |

Los números viven en un único archivo de configuración del backend, así que ajustarlos no
requiere tocar la lógica. El frontend nunca los tiene escritos: los pide al backend.

**Los precios se cobran en pesos** porque Mercado Pago Argentina no acepta suscripciones en
otra moneda. Equivalen a US$ 8 y US$ 25 al dólar MEP del 14/09/2026 y hay que revisarlos cada
tanto por la inflación.

## Dos tipos de límite

**Por período** — solo los viajes. Se reinicia cada vez que empieza un período nuevo.

**Por viaje** — generar, regenerar, buscar alojamiento y buscar vuelos. Se cuentan sobre
ese viaje en particular y **no se reinician** con el período: un viaje del plan Base tiene
3 búsquedas de alojamiento en toda su vida, no 3 por mes.

Los límites se evalúan contra el plan **vigente al momento de la acción**. Si un usuario
pasa de Base a Premium, sus viajes existentes pasan a tener los límites de Premium.

## El período

El período dura un mes y se cuenta **desde el día en que empezó el plan**, no desde el 1°:

- Si pagaste el **13 de agosto**, el período va del 13 de agosto al **13 de septiembre**, y
  el siguiente del 13 de septiembre al 13 de octubre.
- Si ese día no existe en el mes siguiente, vence el **último día** de ese mes, y después
  vuelve al día original: pago el 31 de enero → vence el 28 de febrero → vence el 31 de
  marzo.
- El plan **Gratis** usa la misma regla, contando desde la fecha de registro (o desde el día
  en que venció el último plan pago, si alguna vez tuvo uno).

## Qué cuenta y qué no

- **Una acción cuenta solo si sale bien.** Si Gemini falla, o RapidAPI devuelve 429 porque
  se agotó la cuota, el usuario no pierde su intento: el error es nuestro, no suyo.
- **Borrar un viaje no devuelve el cupo.** Si no, bastaría con crear, borrar y volver a
  crear. El consumo se registra aparte y sobrevive al borrado.
- **El viaje cuenta al crearse**, en el primer paso del asistente de creación, porque los
  pasos siguientes ya buscan vuelos y alojamiento. Para que un asistente abandonado no le
  queme el cupo a nadie sin darse cuenta:
  - El paso 1 avisa que se va a usar un viaje del período.
  - **Solo se permite un viaje en borrador a la vez.** Si hay uno sin terminar, la app
    ofrece retomarlo en vez de crear otro.
- **Buscar alojamiento siempre es una acción explícita del usuario.** Antes la búsqueda se
  disparaba sola al entrar al paso de alojamiento; con planes eso le gastaba al usuario gratis
  su única búsqueda sin haberla pedido, así que pasó a ser un botón.
- **Editar, mover y borrar actividades, ver el mapa y ver el presupuesto nunca cuentan.**
- **Los datos de prueba también cuentan.** Con `RAPIDAPI_MOCK=true` las búsquedas no gastan
  cuota externa, pero sí consumen el límite del plan, para poder probar el sistema de planes
  sin gastar nada.

## Cambios de plan

| Situación | Qué pasa |
|---|---|
| **Subir de plan** (Gratis → Base, Base → Premium) | Aplica apenas se confirma el pago. Empieza un período nuevo desde la fecha del pago, y la suscripción anterior se cancela recién entonces: si el pago nuevo falla, el usuario conserva la que tenía. Los días que quedaban del plan anterior **no se reintegran ni se prorratean**. |
| **Bajar de plan** (Premium → Base) | Se cancela el plan actual, que sigue vigente hasta el fin del período ya pagado. Después, el usuario se suscribe al plan menor. Mientras se cobra un plan mayor, la app no deja suscribirse a uno menor, para no cobrar dos veces. |
| **Cancelar** | Se conservan los beneficios hasta el fin del período pagado. Después pasa a Gratis. |
| **Falla el cobro de la renovación** | **3 días de gracia** con el plan activo y un aviso. Si no se regulariza, pasa a Gratis. Mercado Pago reintenta el cobro por su cuenta: si un reintento se aprueba más tarde, **el plan vuelve a activarse solo**, aunque ya hubiera pasado a Gratis. |

**Bajar de plan nunca borra nada.** Los viajes existentes siguen accesibles y editables
(editar no cuenta para ningún plan). Lo único que cambia es que las acciones nuevas usan
los límites del plan nuevo: si un viaje ya tiene 3 búsquedas de alojamiento y el usuario
pasa a Gratis, no puede hacer una cuarta, pero lo que ya encontró sigue ahí.

## Uso razonable y cuotas externas

"Sin límite" es un límite **del plan**. Hay dos cosas por encima que ningún plan puede
saltear:

**Las cuotas de RapidAPI son de toda la app, no de cada usuario.** Con los planes gratuitos
actuales:

| API | Cuota mensual | Por búsqueda | Búsquedas por mes, **sumando a todos los usuarios** |
|---|---|---|---|
| Sky Scrapper (vuelos) | 20 requests | 4 | **5** |
| Booking (alojamiento) | 50 requests | 2 | **25** |

Un solo usuario Base con cinco viajes agota la cuota de vuelos de todos en un mes. **Antes
de abrir los planes pagos al público hay que pasar esas dos APIs a un plan pago.** Hasta
entonces, el sistema funciona pero "sin límite" es una promesa que la infraestructura no
puede cumplir.

**Protección contra abuso.** Todos los planes, incluido Premium, tienen además un tope
técnico **por usuario, en las últimas 24 horas**:

| Acción | Tope diario |
|---|---|
| Generar o regenerar el itinerario | 10 |
| Buscar vuelos o alojamiento (sumadas) | 20 |

No es una restricción comercial: frena a alguien que regenera o busca en loop, y un uso
normal no debería tocarla nunca. Si se alcanza, el mensaje lo dice así, sin ofrecer subir de
plan (subir no lo levanta).

## Qué ve el usuario

- Su **plan actual** en la barra de navegación y en "Mi plan", dentro del perfil.
- Un **medidor de uso**: *"1 de 1 viajes en este período · se renueva el 13 de octubre"*.
- En cada viaje, lo que le queda: *"Búsquedas de alojamiento: 2 de 3"*.
- Los botones de acciones no incluidas en su plan aparecen **bloqueados, con un candado y
  una invitación a subir de plan**, no escondidos: ocultarlos haría que el usuario gratis no
  sepa que existen.
- Al llegar a un límite, un mensaje claro con el plan que lo habilita, en vez de un error
  genérico.

## Pagos con Mercado Pago

Para el usuario:

1. Elige un plan en la página `/planes`.
2. La app lo redirige al **checkout de Mercado Pago**, donde paga con el medio que quiera.
3. Vuelve a la app, a una página que confirma el pago y le muestra el plan activo.
4. Cada mes Mercado Pago cobra automáticamente. Puede cancelar cuando quiera desde "Mi plan",
   en el perfil, y conserva el plan hasta el fin del período pagado.

**La app nunca ve ni guarda datos de tarjetas.** Todo el pago ocurre dentro de Mercado Pago.

**El plan se activa cuando Mercado Pago confirma el cobro, no cuando el usuario vuelve a la
app.** Volver a la página de éxito no prueba nada: cualquiera puede escribir esa URL a mano.
Lo que activa y renueva un plan es siempre la respuesta de la API de Mercado Pago, que se
consulta por tres caminos:

- **La notificación de Mercado Pago (webhook)**, firmada: es el camino principal. La app
  valida la firma y vuelve a pedir los datos a la API, porque el cuerpo de una notificación se
  puede falsificar.
- **La vuelta del checkout**: la página de resultado pregunta el estado y el backend lo
  confirma con Mercado Pago, así el plan se activa aunque la notificación demore.
- **El respaldo de las renovaciones**: si un plan pago llega al fin de lo pagado sin que haya
  llegado el aviso del cobro, la app le pregunta a Mercado Pago antes de pasarlo a gracia.

Cada cobro aprobado habilita un período más, y aplicar dos veces el mismo cobro no cambia
nada: da igual cuántas veces o en qué orden lleguen los avisos.

## Decisiones pendientes

- **Pasar Sky Scrapper y Booking a planes pagos** de RapidAPI antes de lanzar (ver arriba).
- **Túnel: ngrok hasta tener un dominio propio.** Con ngrok el pago funciona, pero los avisos de
  Mercado Pago no llegan. Con dominio propio se pasa a Cloudflare (un túnel con nombre y un
  subdominio fijo, o directamente el dominio del servidor en producción) y ahí se verifica que
  llegue el aviso del cobro mensual. En el sandbox no se puede disparar a pedido; mientras tanto
  lo cubre el respaldo de las renovaciones.
- **Revisar los precios en pesos** cada tanto por la inflación.
- Si más adelante se quiere **prorratear** los cambios de plan en vez de empezar un período
  nuevo.
