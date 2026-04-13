
# Formattr

Formattr is a visual document-processing prototype: upload source files, assemble a linear workflow on a canvas, run the job asynchronously through Supabase, and download one or more generated outputs.

The current repository is focused on the core pipeline loop. Auth screens exist, but auth enforcement is optional and disabled by default. Billing and saved pipelines are not wired yet.

## What Exists Today

- A Next.js 16.2.3 / React 19 App Router frontend.
- A React Flow canvas for building a step-by-step workflow.
- Direct uploads to Supabase Storage through signed upload URLs.
- Async job execution in a Supabase Edge Function.
- Realtime job completion updates through Supabase `postgres_changes`.
- Downloadable output snapshots at any `output` node in the workflow.

## Supported Workflow Steps

- `merge`: merge PDF inputs into a single PDF before later steps.
- `extract-text`: turn files into plain text.
- `extract`: ask Claude to produce either table output or plain text.
- `csv-parser`: fill `{{placeholders}}` from a CSV template and return table data.
- `output`: materialize the current pipeline state into a downloadable file.

## End-to-End Flow

1. The source node accepts PDFs, spreadsheets, and CSV files.
2. The client requests signed upload URLs from `POST /api/upload/presign`.
3. Files upload directly to the `source-files` bucket.
4. The client posts a serialized workflow to `POST /api/jobs`.
5. The API inserts a `jobs` row and schedules the Supabase Edge Function with `after()`.
6. The edge function downloads files, executes each step in order, writes result files to the `results` bucket, and updates the job row.
7. The client listens for `jobs` updates over Supabase Realtime and turns `result_paths` into signed download URLs.

## Stack

- Framework: Next.js 16.2.3, React 19, TypeScript
- Styling: Tailwind CSS v4, global design tokens in `src/app/globals.css`
- UI primitives: Base UI / shadcn-style components in `src/components/ui`
- Canvas: `@xyflow/react`
- State: Zustand
- Backend platform: Supabase Auth, Storage, Postgres, Realtime, Edge Functions
- AI execution: Anthropic SDK inside the edge function
- PDF previews: `pdfjs-dist`

## Project Map

```text
src/
  app/
    api/
      jobs/             create and inspect processing jobs
      upload/presign/   create signed upload URLs
    auth/               server actions and auth callback
    login/ signup/      auth screens
    pipeline/           main product route
  components/
    pipeline/           workflow canvas and node UIs
    ui/                 generated/shared UI primitives
  lib/
    supabase/           client/server Supabase helpers
    pdf-thumbnail.ts    first-page PDF thumbnail generation
  store/
    pipeline.ts         pipeline graph types and job state
supabase/
  functions/process-job/
    index.ts            job executor
    handlers/           per-step execution logic
```

More detail lives in [docs/CODEBASE.md](docs/CODEBASE.md).

## Local Development

This repo snapshot does not include `node_modules`, so install dependencies before running the app.

```bash
bun install
bun run dev
```

You can also use `npm install` and `npm run dev` if that is your local standard.

## Required Environment Variables

Next.js app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `AUTH_ENABLED` (optional, set to `true` to require auth in APIs)

Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

## Supabase Expectations

The repo does not include migrations, so the schema below is inferred from the application code:

- Storage bucket `source-files`: raw uploads, template files, and temporary merged files.
- Storage bucket `results`: durable output artifacts.
- Table `jobs` with fields used by the app:
  - `id`
  - `user_id`
  - `status`
  - `input_paths`
  - `input_names`
  - `pipeline_steps`
  - `result_paths`
  - `error_message`

## Current Caveats

- The workflow model is linear, not a general DAG, even though the UI uses React Flow.
- `/pipeline` is not server-protected in this repo; auth enforcement only exists inside selected API routes and is off unless `AUTH_ENABLED=true`.
- The left-side usage panel is placeholder UI; balance and estimated cost are hardcoded.
- `GET /api/jobs/[id]` appears to be older code that returns a single `result_path`, while the main app now uses realtime `result_paths`.
- `csv-parser` accepts `.xlsx` and `.xls` templates in the UI, but the edge handler currently parses the template as raw CSV text.
- There are no tests and no checked-in database migrations.
