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

- **`GEMINI_API_KEY` está vacía** en `backend/.env`, así que `POST
  /viajes/:id/itinerario/generar` devuelve 500 (el SDK sin key cae a Vertex AI y
  da 401 `CREDENTIALS_MISSING`). Para ejercitar el itinerario, sembralo directo en
  la DB con Prisma en vez de generarlo.
- Prisma se instancia con un adapter, no con la URL sola:
  `new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) })`.
  El client compilado vive en `backend/dist/generated/prisma/client.js`
  (`backend/generated/` es TypeScript sin compilar).
- `RAPIDAPI_MOCK=true` en `.env` usa fixtures y **ignora `adultos` y
  `habitaciones`**. Para ver los parámetros reales de Booking, arrancá con
  `RAPIDAPI_MOCK=false node dist/src/main`. Cuidado: el free tier tira 429 si
  repetís las búsquedas.
