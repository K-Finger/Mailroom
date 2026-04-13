import { supabase } from "./clients.ts";
import { shapeToResult } from "./helpers.ts";
import { merge } from "./handlers/merge.ts";
import { extractText } from "./handlers/extract-text.ts";
import { extract } from "./handlers/extract.ts";
import { csvParser } from "./handlers/csv-parser.ts";
import { validator } from "./handlers/validator.ts";
import { filter } from "./handlers/filter.ts";
import { sendEmail } from "./handlers/email.ts";
import type { StepData, PipelineStep, StepHandler } from "./types.ts";

const handlers: Record<string, StepHandler> = {
  merge,
  "extract-text": extractText,
  extract,
  "csv-parser": csvParser,
  validator,
  filter,
};

Deno.serve(async (req) => {
  const { jobId } = await req.json() as { jobId: string };

  await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

  try {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, user_id, input_paths, input_names, pipeline_steps")
      .eq("id", jobId)
      .single();

    if (error || !job) throw new Error("Job not found");

    const steps = (job.pipeline_steps ?? []) as PipelineStep[];
    let data: StepData = { shape: "files", paths: job.input_paths, names: job.input_names };
    const resultPaths: { nodeId: string; path: string }[] = [];

    // Tracks all source-files paths to delete after the job completes.
    // Starts with input files + any template files; handlers add temp paths (e.g. merged PDFs).
    const cleanup = new Set<string>([
      ...job.input_paths,
      ...steps.flatMap((s) => s.config.templatePath ? [s.config.templatePath] : []),
    ]);

    for (const step of steps) {
      if (step.type === "output") {
        if (!step.config.nodeId) throw new Error("Output step missing nodeId");

        const { bytes, filename, contentType } = await shapeToResult(data, step.config.tableFormat);
        const resultPath = `${job.user_id}/${jobId}/${step.config.nodeId}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("results")
          .upload(resultPath, bytes, { contentType, upsert: true });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        resultPaths.push({ nodeId: step.config.nodeId, path: resultPath });
        continue; // data passes through unchanged
      }

      if (step.type === "google-sheets") {
        if (!step.config.nodeId) throw new Error("Google Sheets step missing nodeId");
        if (!step.config.sheetId) throw new Error("Google Sheets step missing sheetId");
        if (data.shape !== "table") throw new Error("Google Sheets step requires table data");

        const { data: userData } = await supabase
          .from("users")
          .select("google_access_token")
          .eq("id", job.user_id)
          .single();

        if (!userData?.google_access_token) {
          throw new Error("No Google token — sign out and back in to reconnect Drive");
        }

        const sheetTab = step.config.sheetTab ?? "Sheet1";
        const values = [
          data.columns,
          ...data.rows.map((row) => data.columns.map((col) => row[col] ?? "")),
        ];

        const sheetsRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${step.config.sheetId}/values/${encodeURIComponent(sheetTab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${userData.google_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values }),
          },
        );

        if (!sheetsRes.ok) {
          const err = await sheetsRes.json() as { error?: { message?: string } };
          throw new Error(`Sheets API error: ${err.error?.message ?? sheetsRes.status}`);
        }

        resultPaths.push({ nodeId: step.config.nodeId, path: `sheets://${step.config.sheetId}` });
        // data passes through unchanged — downstream steps can still use it
        continue;
      }

      if (step.type === "email") {
        if (!step.config.nodeId) throw new Error("Email step missing nodeId");
        await sendEmail(data, step.config);
        resultPaths.push({ nodeId: step.config.nodeId, path: "email://sent" });
        // data passes through unchanged
        continue;
      }

      const handler = handlers[step.type];
      if (!handler) throw new Error(`Unknown step: ${step.type}`);
      if (!handler.accepts.includes(data.shape)) {
        throw new Error(`${step.type} cannot accept ${data.shape}`);
      }
      data = await handler.run(data, step.config, cleanup);
    }

    await supabase.from("jobs").update({ status: "done", result_paths: resultPaths }).eq("id", jobId);

    // Report usage to Stripe if configured
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const meterName = Deno.env.get("STRIPE_METER_NAME") ?? "documents_processed";
    if (stripeKey) {
      const { data: userData } = await supabase
        .from("users")
        .select("stripe_customer_id")
        .eq("id", job.user_id)
        .single();
      if (userData?.stripe_customer_id) {
        await fetch("https://api.stripe.com/v1/billing/meter_events", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            event_name: meterName,
            "payload[stripe_customer_id]": userData.stripe_customer_id,
            "payload[value]": String(job.input_paths.length),
          }),
        });
      }
    }

    // Delete source files, template files, and temp files — results are kept.
    if (cleanup.size > 0) {
      await supabase.storage.from("source-files").remove([...cleanup]);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("jobs").update({ status: "error", error_message: msg }).eq("id", jobId);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
