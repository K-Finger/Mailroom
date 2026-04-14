# Mailroom — Claude Code Instructions

## App

Visual document workflow automation (n8n/Make for PDF/spreadsheet/forms ops). Nodes on canvas: drop files → chain AI steps → download XLSX or send to Google Sheets / email.

**MVP order:** Pipeline (file→process→download) → Auth → Billing → Saved pipelines. Don't gold-plate auth/billing until core loop solid.

### Node types

| Node | StepType | Accepts | Produces | Purpose |
|---|---|---|---|---|
| `sourceNode` | — | — | files | File input (local upload or Google Drive folder) |
| `extract` | `extract` | files, texts | table / texts | AI Extract — freeform prompt + optional template |
| `csv-parser` | `csv-parser` | files, texts | table | CSV with `{{placeholder}}` fields |
| `extract-text` | `extract-text` | files | texts | Pull plain text from files |
| `merge` | `merge` | files | files | Combine PDFs into one |
| `filter` | `filter` | table | table | Keep rows matching all conditions |
| `validator` | `validator` | table | table | Check rows against rules (required, range, regex…) |
| `google-sheets` | `google-sheets` | table | table | Append rows to existing Google Sheet (pass-through) |
| `email` | `email` | any | same | Send result as email attachment (pass-through) |
| `output` | `output` | any | — | Download result as XLSX or CSV |

**Adding a new node:** one `StepType` in `src/store/pipeline.ts`, one `InstructionPayload` variant, one entry in `STEP_IO`, one entry in `INSTRUCTION_TYPES` in `instruction-picker.tsx`, one component in `src/components/pipeline/nodes/`, entry in `TYPE_META` in `InstructionNode.tsx`, entry in `STEP_ICONS` + pipelineSteps builder in `Pipeline.tsx`, handler in `supabase/functions/process-job/`.

Note: `InstructionType = StepType` (alias, not a separate type).

---

## Next.js — READ FIRST

Runs **Next.js 16.2.3** — breaking changes from prior versions. Before writing Next.js code: check `node_modules/next/dist/docs/`. APIs/conventions differ from training data.

Auth gate uses `src/proxy.ts` (not `middleware.ts`) with `export function proxy`. Do NOT use `@supabase/ssr` inside proxy — causes Turbopack Edge Runtime error. Use lightweight cookie check only.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3, React 19, TypeScript, App Router |
| UI | shadcn/ui + Tailwind v4. Brand blue `oklch(0.53 0.17 250)` = `--brand`. `text-blue-700` for Mailroom wordmark. |
| DB/Storage/Auth | Supabase (Postgres + Storage + Realtime + Auth) via `@supabase/ssr` |
| Billing | Stripe, one-time credit packs ($1.99 / 50 runs) |
| AI | `@anthropic-ai/sdk`, `claude-sonnet-4-6`, structured outputs |
| Pipeline state | Zustand `src/store/pipeline.ts` |
| Server state | Supabase Realtime — **never TanStack Query polling** |
| Canvas | `@xyflow/react` |
| Icons | `lucide-react` |
| Toast | `sonner` |
| Email | Resend (`RESEND_API_KEY` + optional `FROM_EMAIL`) |

---

## Architecture

### Routes

```
src/app/
  pipeline/         # Authenticated — main canvas
  login/            # Unauthenticated
  billing/          # Authenticated — credit balance + buy more
  api/
    jobs/           # POST: create job + fire Edge Function via after()
    upload/presign/ # POST: Supabase Storage signed upload URLs
    stripe/
      webhook/      # POST: Stripe webhook — grants credits on checkout.session.completed
    google-drive/
      token/        # GET: refresh + return google_access_token for current user
    gmail/          # Gmail API proxy routes
    drive-watchers/ # GET: list watchers; POST: create/upsert watcher
    drive-watchers/[id]/ # DELETE: remove watcher
    cron/
      drive-watch/  # GET: Vercel cron — polls Drive folders, fires jobs for new files
```

### Job flow

1. `POST /api/upload/presign` → `{ path, token }` per file
2. Client uploads direct to Supabase Storage (bypass Vercel body limit)
3. `POST /api/jobs` → insert `jobs` row, fire Edge Function via `after()`
4. Edge Function runs pipeline steps, uploads result, updates `jobs.status`
5. Client subscribes via **Supabase Realtime** `postgres_changes` on `jobs`

### Result path conventions (from Edge Function)
- Regular file: storage path → `createSignedUrl` in Pipeline.tsx
- Google Sheets: `sheets://{spreadsheetId}` → converted to full URL
- Email sent: `email://sent` → `results[nodeId] = "sent"`

### Supabase clients

- `src/lib/supabase/server.ts` — server components, API routes
- `src/lib/supabase/client.ts` — **singleton** client component. Uses module-level `_client` cache — never call `createBrowserClient` directly (leaks WebSocket connections).

**Auth disabled for dev.** Hardcoded UUID `00000000-0000-0000-0000-000000000000` as `user_id`, service role bypasses RLS. Flip before launch.

### Edge Function

`supabase/functions/process-job/index.ts` — Deno. Deps: `jsr:@supabase/supabase-js@2`, `npm:@anthropic-ai/sdk@0.88.0`, `npm:exceljs`, `npm:unpdf`.

Uses `claude-haiku-4-5-20251001` (cost). Next.js app uses `claude-sonnet-4-6`.

Special step handling (not in `handlers` map): `output`, `google-sheets`, `email` — handled inline in the main loop because they are side-effect/terminal steps.

---

## Constraints — never violate

1. **Vercel 4.5 MB / 60s** — large files go direct-to-Storage via presigned URLs. Never stream through API routes.
2. **No polling** — Supabase Realtime only. No `setInterval`, no React Query.
3. **Structured outputs mandatory** — JSON schema per doc type, nullable fields. No free-form Claude text where structured needed.
4. **Middleware is auth gate** — `src/proxy.ts` protects `/pipeline` and `/api/`. Layout-level checks not enough.
5. **`after()` for side effects** — `POST /api/jobs` fires Edge Function after response sent. Don't block response.
6. **Supabase client is a singleton** — never recreate `createBrowserClient` on re-render.

---

## Zustand store (`src/store/pipeline.ts`)

Job state only: `step`, `jobId`, `results`, `error`. ReactFlow node/edge state lives in `Pipeline.tsx` via `useNodesState` / `useEdgesState`.

Key types: `StepType`, `DataShape`, `InstructionPayload`, `PipelineStep`, `STEP_IO`, `producedShape()`.

---

## Patterns

- **Supabase client**: use `src/lib/supabase/` helpers only. Never raw `createClient` from `@supabase/supabase-js` in app code (service role exception: API routes only).
- **Components**: server by default. `"use client"` only for event handlers, hooks, ReactFlow.
- **Tailwind**: use `blue-*` scale for brand. `var(--brand)` in CSS. No hardcoded hex in components. `bg-linear-to-b` not `bg-gradient-to-b` (Tailwind v4).
- **shadcn**: `bunx shadcn add <component>`. Don't hand-roll.
- **Errors**: Edge Function try/catch sets `jobs.status = "error"` + `error_message`. Surface via Realtime, not HTTP codes. Client-side errors use `sonner` toast.
- **Google OAuth**: scopes `drive.readonly` + `spreadsheets` + `gmail.readonly` requested at sign-in. Token stored in `users.google_access_token`. `/api/google-drive/token` refreshes via `supabase.auth.refreshSession()` then returns the fresh token.
- **Server actions with redirect**: wrap in `useTransition` + `startTransition` on the client — `redirect()` inside a server action throws and must not be called from a raw onClick.

---

## Billing model

Credits-based, one-time purchase. No subscription.

- `users.document_credits` — integer, decremented per job run
- `users.stripe_customer_id` — stored after first purchase to reuse customer
- **Buy**: `buyCredits()` server action → Stripe Checkout (`mode: "payment"`) → success redirect to `/billing?success=true`
- **Webhook** (`/api/stripe/webhook`): only handles `checkout.session.completed` with `payment_status === "paid"` → calls `supabase.rpc("add_credits", { user_id, amount })`
- **Job gate** (`/api/jobs`): when `BILLING_ENABLED=true`, calls `supabase.rpc("deduct_credit", { user_id })` — returns false if no credits → 402
- **Billing page** (`/billing`): shows current credit balance + "Buy 50 runs for $1.99" button. Same blue gradient as login page.

No meter events, no portal, no subscription status fields.

---

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server/edge only
ANTHROPIC_API_KEY              # edge only
RESEND_API_KEY                 # edge only — email node
FROM_EMAIL                     # edge only — email sender (optional, default noreply@mailroom.app)
NEXT_PUBLIC_GOOGLE_API_KEY     # client — Google Picker (optional but recommended)
NEXT_PUBLIC_APP_URL            # canonical app URL (e.g. https://mailroom.app) — Stripe redirects
STRIPE_SECRET_KEY              # server — Stripe API
STRIPE_WEBHOOK_SECRET          # server — webhook signature verification
STRIPE_PRICE_ID                # server — Stripe one-time price ID (not a recurring price)
BILLING_ENABLED                # server — set to "true" to enforce credit gate on /api/jobs
GOOGLE_CLIENT_ID               # server — Google OAuth client ID (from Cloud Console)
GOOGLE_CLIENT_SECRET           # server — Google OAuth client secret (from Cloud Console)
CRON_SECRET                    # server — Vercel cron secret (set in Vercel project settings)
```

---

## Deploy checklist (production / hackathon)

### 1. Supabase migrations
Migrations are applied to local DB via MCP. For a **separate production project**, run these manually in the Supabase SQL editor:
- `supabase/migrations/20260413000000_add_stripe_fields.sql` — adds `stripe_customer_id`, `document_credits` to `users`; adds `add_credits` and `deduct_credit` RPC functions
- The `saved_pipelines` table migration (check Supabase → Database → Migrations to confirm it exists)

### 2. Stripe setup (live mode)
1. Create account → switch to **live mode**
2. Products → create a Product → add a **one-time** Price (not recurring) for $1.99 → copy `price_xxx`
3. Developers → API keys → copy `sk_live_xxx`
4. Webhooks → Add endpoint → URL: `https://yourdomain.com/api/stripe/webhook`
   Events to select: `checkout.session.completed` (only this one needed)
   → copy `whsec_xxx`

### 3. Vercel env vars
Set in Vercel dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
BILLING_ENABLED=true
NEXT_PUBLIC_APP_URL=https://yourdomain.com
RESEND_API_KEY                  (email node)
FROM_EMAIL                      (optional)
NEXT_PUBLIC_GOOGLE_API_KEY      (Drive picker, optional)
```

Also set in **Supabase → Edge Functions → Secrets**:
```
ANTHROPIC_API_KEY
RESEND_API_KEY
FROM_EMAIL
```

### 4. Known bugs to fix
- **Dropdown** The dropdown menu for output node's file type is to the side of the card away. it's disconnected and makes u move the mouse to get to it
- **Gmail API** Must be enabled in Google Cloud Console for the OAuth client project before Gmail node will work

### 5. Deploy
```bash
git push origin kieran  # open PR → merge to main → Vercel auto-deploys
```
Test end-to-end with a real card in live mode before sharing.

---

## File locations

| Thing | Path |
|---|---|
| Pipeline UI | `src/components/pipeline/Pipeline.tsx` |
| Node components | `src/components/pipeline/nodes/` |
| Node picker | `src/components/pipeline/instruction-picker.tsx` |
| Zustand store | `src/store/pipeline.ts` |
| Auth gate | `src/proxy.ts` |
| Supabase helpers | `src/lib/supabase/` |
| Google Drive utils | `src/lib/google-drive/picker.ts` |
| Gmail utils | `src/lib/gmail/` |
| Drive watcher API | `src/app/api/drive-watchers/` |
| Drive watch cron | `src/app/api/cron/drive-watch/route.ts` |
| Vercel cron config | `vercel.json` |
| Logo | `public/logo.svg` |
| Job API | `src/app/api/jobs/route.ts` |
| Presign API | `src/app/api/upload/presign/route.ts` |
| Stripe webhook | `src/app/api/stripe/webhook/route.ts` |
| Gmail API routes | `src/app/api/gmail/` |
| Billing page | `src/app/billing/page.tsx` |
| Billing actions | `src/app/billing/actions.ts` |
| Edge Function | `supabase/functions/process-job/index.ts` |
| Edge handlers | `supabase/functions/process-job/handlers/` |
| Global CSS | `src/app/globals.css` |
