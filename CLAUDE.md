# Formattr — Claude Code Instructions

## What this app does

Formattr is a **visual automation platform for document workflows** — the n8n/Make equivalent for ops teams who live in PDFs, spreadsheets, and forms. Users build pipelines by connecting nodes on a canvas: drop in files, chain AI extraction steps, parse CSVs, transcribe audio, and output structured XLSX downloads — all without writing code.

The core differentiator vs n8n is the document-native focus: every node understands files, not just API payloads. Claude does the heavy lifting inside each processing node.

**MVP priority order:** Pipeline tab (file in → process → download) → Auth → Billing → Saved pipelines / scheduling. Do not gold-plate auth or billing until the core loop is solid.

### Pipeline node types (current)

| Node | Purpose |
|---|---|
| `sourceNode` | File input — PDFs, spreadsheets, audio |
| `extract` | AI Extract — freeform prompt + optional output template |
| `csv-parser` | CSV with `{{placeholder}}` fields to fill from source data |
| `transcribe` | Audio / video / scanned image → text |
| `output` | Materialise pipeline data as XLSX download |

New node types should follow this pattern: one `InstructionType` string, one `InstructionPayload` variant in `src/store/pipeline.ts`, one node component in `src/components/pipeline/nodes/`, one entry in `INSTRUCTION_TYPES` in `instruction-picker.tsx`.

---

## Next.js version — read before writing any code

This project runs **Next.js 16.2.3** which has breaking changes from previous versions. Before writing any Next.js-specific code, check the guide in `node_modules/next/dist/docs/`. Heed deprecation notices — APIs, conventions, and file structure may differ from your training data.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3, React 19, TypeScript, App Router |
| UI | shadcn/ui + Tailwind CSS v4. Brand green: `#217346` wired as `--primary` |
| Database / Storage / Auth | Supabase (Postgres + Storage + Realtime + Auth) via `@supabase/ssr` |
| Billing | Stripe, usage-based, `documents_processed` meter |
| AI | `@anthropic-ai/sdk`, model `claude-sonnet-4-6`, structured outputs |
| Pipeline UI state | Zustand (`src/store/pipeline.ts`) |
| Server state / polling | Supabase Realtime — **never TanStack Query polling** |
| Pipeline canvas | `@xyflow/react` |
| Icons | `lucide-react` |
| Toast | `sonner` |

---

## Architecture

### Route groups

```
src/app/
  (app)/              # Authenticated shell — pipeline, dashboard
    pipeline/
  (auth)/             # Unauthenticated pages — login, signup
  api/
    jobs/             # POST: create job record + fire Edge Function via next/server `after()`
    upload/
      presign/        # POST: generate Supabase Storage signed upload URLs
```

### Job flow

1. Client calls `POST /api/upload/presign` → gets signed URLs
2. Client uploads files directly to Supabase Storage (bypasses Vercel body limit)
3. Client calls `POST /api/jobs` → inserts `jobs` row, fires Edge Function via `after()`
4. Edge Function (`supabase/functions/process-job/index.ts`) downloads files, calls Claude, uploads XLSX result, updates `jobs.status`
5. Client subscribes to `jobs` table via **Supabase Realtime** (postgres_changes) — reacts to status updates

### Supabase clients

- `src/lib/supabase/server.ts` — server components, API routes, middleware
- `src/lib/supabase/client.ts` — client components only

**Auth is currently disabled for dev** (`AUTH_ENABLED = false` in API routes). Flip to `true` before launch. When disabled, a hardcoded UUID `00000000-0000-0000-0000-000000000000` is used as `user_id` and the service role client bypasses RLS.

### Supabase Edge Function

`supabase/functions/process-job/index.ts` — Deno runtime. Uses:
- `jsr:@supabase/supabase-js@2`
- `npm:@anthropic-ai/sdk@0.88.0`
- `npm:exceljs` for XLSX generation
- `npm:unpdf` for PDF text extraction

Claude is called with `claude-haiku-4-5-20251001` in the Edge Function (cost optimization). The Next.js app uses `claude-sonnet-4-6` for any other Claude calls.

---

## Key constraints — do not violate these

1. **Vercel 4.5 MB body limit + 60s timeout** — large files always go direct-to-Supabase Storage via presigned URLs. Never stream large files through Next.js API routes.

2. **No polling** — use Supabase Realtime (`postgres_changes` on `jobs` table) for job status. Never poll with `setInterval` or React Query.

3. **Structured outputs mandatory** — define a JSON schema per document type. Allow nullable fields. Never ask Claude for free-form text where structured data is needed.

4. **Supabase SSR middleware protects `/pipeline` and `/api/` routes** — layout-level auth checks alone are insufficient. Middleware is the gate.

5. **`after()` for async side effects** — the `POST /api/jobs` route uses `next/server`'s `after()` to fire the Edge Function after the response is sent. Do not block the response on Edge Function completion.

---

## Zustand store (`src/store/pipeline.ts`)

Owns:
- Pipeline node/edge graph (ReactFlow state managed locally in `Pipeline.tsx`)
- `step: ProcessingStep` — `idle | uploading | processing | done | error`
- `jobId`, `resultUrl`, `error`

Node types: `sourceNode` (file inputs), `instructionNode` (extract / csv-parser / transcribe / output).

---

## Patterns to follow

- **Supabase client creation**: always use the helpers in `src/lib/supabase/`. Never instantiate `createClient` from `@supabase/supabase-js` directly in app code (service role is the one exception, and only in API routes).
- **Component conventions**: server components by default; add `"use client"` only when needed (event handlers, hooks, ReactFlow).
- **Tailwind**: use CSS variables (`var(--primary)`) and `color-mix()` for opacity variants — consistent with existing palette. Avoid hardcoded hex in components.
- **shadcn/ui**: add components via `bunx shadcn add <component>`, don't hand-roll equivalents.
- **Error handling**: structured try/catch in Edge Function updates `jobs.status = "error"` with `error_message`. Surface errors through Realtime, not HTTP response codes to the client.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server/edge only — never expose to client
ANTHROPIC_API_KEY              # edge function only
STRIPE_SECRET_KEY              # not yet wired
```

---

## File locations cheat sheet

| Thing | Where |
|---|---|
| Pipeline UI | `src/components/pipeline/Pipeline.tsx` |
| Pipeline node components | `src/components/pipeline/nodes/` |
| Zustand store | `src/store/pipeline.ts` |
| Supabase helpers | `src/lib/supabase/` |
| Job creation API | `src/app/api/jobs/route.ts` |
| Presign API | `src/app/api/upload/presign/route.ts` |
| Edge Function | `supabase/functions/process-job/index.ts` |
| Global CSS + palette | `src/app/globals.css` |
