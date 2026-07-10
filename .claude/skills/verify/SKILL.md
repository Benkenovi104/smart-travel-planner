---
name: verify
description: Levantar y manejar Smart Travel Planner (NestJS + Next) para observar un cambio funcionando de punta a punta.
---

# Verificar Smart Travel Planner

Backend NestJS en `:3000` (prefijo `/api`), frontend Next en `:3001`. La DB es
**Supabase remota** — no hace falta docker, pero las respuestas tardan ~1-2s.

## Levantar

```bash
cd backend && npx nest build && node dist/src/main    # NO uses dist/ viejo: recompilá siempre
cd frontend && npm run dev                             # :3001
```

Si el puerto 3000 quedó tomado por una corrida anterior:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Manejar la API

Scripts `.mjs` con `fetch` — **no uses `curl`**: en Git Bash sobre Windows los
acentos se mandan como cp1252 y el backend recibe basura.

Flujo mínimo: `POST /api/auth/register` → `POST /api/auth/login` (devuelve
`access_token`) → `Authorization: Bearer` en el resto.

## Manejar la GUI

Playwright no está en el repo; instalalo en el scratchpad:

```bash
npm i playwright && npx playwright install chromium
```

Registro y creación de viaje por la UI. Ojo con los tiempos: por Supabase remoto,
esperá a que el diálogo se cierre (`dialog.waitFor({state:'hidden'})`) en vez de
usar `waitForTimeout` fijo, o vas a screenshotear el spinner.

Selectores ambiguos: el botón "Agregar" existe dos veces (el del día y el submit
del diálogo). Scopeá con `page.getByRole('dialog').getByRole('button', ...)`.

## Trampas del entorno

- **Claude Code inyecta variables de Vertex AI en sus procesos** (`GOOGLE_GENAI_USE_VERTEXAI=true`,
  `GOOGLE_CLOUD_PROJECT`, `GOOGLE_VERTEX_BASE_URL`, `GOOGLE_API_KEY`). `@google/genai` las mira
  **antes** que el `apiKey`, se va a `aiplatform.googleapis.com` e ignora `GEMINI_API_KEY`; Vertex
  rechaza las API keys y `POST /viajes/:id/itinerario/generar` devuelve 500. Levantá el backend
  limpiándolas, o vas a diagnosticar un bug que no existe:

  ```bash
  env -u GOOGLE_GENAI_USE_VERTEXAI -u GOOGLE_CLOUD_PROJECT -u GOOGLE_CLOUD_LOCATION \
      -u GOOGLE_VERTEX_BASE_URL -u GOOGLE_API_KEY node dist/src/main
  ```

  Generar un itinerario tarda ~50s y gasta cuota de Gemini. Si sólo necesitás días para colgar
  actividades, sembralos con Prisma en vez de generarlos.
- Prisma se instancia con un adapter, no con la URL sola:
  `new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) })`.
  El client compilado vive en `backend/dist/generated/prisma/client.js`
  (`backend/generated/` es TypeScript sin compilar).
- `RAPIDAPI_MOCK=true` en `.env` usa fixtures y **ignora `adultos` y
  `habitaciones`**. Para ver los parámetros reales de Booking, arrancá con
  `RAPIDAPI_MOCK=false node dist/src/main`. Cuidado: el free tier tira 429 si
  repetís las búsquedas.
