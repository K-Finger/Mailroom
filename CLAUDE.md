# Formattr — Claude Code Instructions

## App

Visual document workflow automation (n8n/Make for PDF/spreadsheet/forms ops). Nodes on canvas: drop files → chain AI steps → download XLSX. Claude does processing inside each node.

**MVP order:** Pipeline (file→process→download) → Auth → Billing → Saved pipelines. Don't gold-plate auth/billing until core loop solid.

### Node types

| Node | Purpose |
|---|---|
| `sourceNode` | File input — PDFs, spreadsheets, audio |
| `extract` | AI Extract — freeform prompt + optional template |
| `csv-parser` | CSV with `{{placeholder}}` fields |
| `transcribe` | Audio/video/image → text |
| `output` | Materialise pipeline as download |

New node: one `InstructionType`, one `InstructionPayload` variant in `src/store/pipeline.ts`, one component in `src/components/pipeline/nodes/`, one entry in `INSTRUCTION_TYPES` in `instruction-picker.tsx`.

---

## Next.js — READ FIRST

Runs **Next.js 16.2.3** — breaking changes from prior versions. Before writing Next.js code: check `node_modules/next/dist/docs/`. APIs/conventions differ from training data.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3, React 19, TypeScript, App Router |
| UI | shadcn/ui + Tailwind v4. Brand green `#217346` = `--primary` |
| DB/Storage/Auth | Supabase (Postgres + Storage + Realtime + Auth) via `@supabase/ssr` |
| Billing | Stripe, usage-based, `documents_processed` meter |
| AI | `@anthropic-ai/sdk`, `claude-sonnet-4-6`, structured outputs |
| Pipeline state | Zustand `src/store/pipeline.ts` |
| Server state | Supabase Realtime — **never TanStack Query polling** |
| Canvas | `@xyflow/react` |
| Icons | `lucide-react` |
| Toast | `sonner` |

---

## Architecture

### Routes

```
src/app/
  (app)/          # Authenticated — pipeline, dashboard
  (auth)/         # Unauthenticated — login, signup
  api/
    jobs/         # POST: create job + fire Edge Function via after()
    upload/presign/ # POST: Supabase Storage signed upload URLs
```

### Job flow

1. `POST /api/upload/presign` → signed URLs
2. Client uploads direct to Supabase Storage (bypass Vercel body limit)
3. `POST /api/jobs` → insert `jobs` row, fire Edge Function via `after()`
4. Edge Function downloads files, calls Claude, uploads result, updates `jobs.status`
5. Client subscribes via **Supabase Realtime** `postgres_changes` on `jobs`

### Supabase clients

- `src/lib/supabase/server.ts` — server components, API routes, middleware
- `src/lib/supabase/client.ts` — client components only

**Auth disabled for dev** (`AUTH_ENABLED = false`). Hardcoded UUID `00000000-0000-0000-0000-000000000000` as `user_id`, service role bypasses RLS. Flip `true` before launch.

### Edge Function

`supabase/functions/process-job/index.ts` — Deno. Deps: `jsr:@supabase/supabase-js@2`, `npm:@anthropic-ai/sdk@0.88.0`, `npm:exceljs`, `npm:unpdf`.

Edge Function uses `claude-haiku-4-5-20251001` (cost). Next.js app uses `claude-sonnet-4-6`.

---

## Constraints — never violate

1. **Vercel 4.5 MB / 60s** — large files go direct-to-Storage via presigned URLs. Never stream through API routes.
2. **No polling** — Supabase Realtime only. No `setInterval`, no React Query.
3. **Structured outputs mandatory** — JSON schema per doc type, nullable fields. No free-form Claude text where structured needed.
4. **Middleware is auth gate** — SSR middleware protects `/pipeline` and `/api/`. Layout-level checks not enough.
5. **`after()` for side effects** — `POST /api/jobs` fires Edge Function after response sent. Don't block response.

---

## Zustand store (`src/store/pipeline.ts`)

- Node/edge graph (ReactFlow state in `Pipeline.tsx`)
- `step: ProcessingStep` — `idle | uploading | processing | done | error`
- `jobId`, `resultUrl`, `error`

Node types: `sourceNode` (files), `instructionNode` (extract / csv-parser / transcribe / output).

---

## Patterns

- **Supabase client**: use `src/lib/supabase/` helpers only. Never raw `createClient` from `@supabase/supabase-js` in app code (service role exception: API routes only).
- **Components**: server by default. `"use client"` only for event handlers, hooks, ReactFlow.
- **Tailwind**: `var(--primary)` + `color-mix()` for opacity. No hardcoded hex in components.
- **shadcn**: `bunx shadcn add <component>`. Don't hand-roll.
- **Errors**: Edge Function try/catch sets `jobs.status = "error"` + `error_message`. Surface via Realtime, not HTTP codes.

---

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server/edge only
ANTHROPIC_API_KEY           # edge only
STRIPE_SECRET_KEY           # not wired yet
```

---

## File locations

| Thing | Path |
|---|---|
| Pipeline UI | `src/components/pipeline/Pipeline.tsx` |
| Node components | `src/components/pipeline/nodes/` |
| Zustand store | `src/store/pipeline.ts` |
| Supabase helpers | `src/lib/supabase/` |
| Job API | `src/app/api/jobs/route.ts` |
| Presign API | `src/app/api/upload/presign/route.ts` |
| Edge Function | `supabase/functions/process-job/index.ts` |
| Global CSS | `src/app/globals.css` |
