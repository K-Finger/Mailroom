import { supabase } from "./clients.ts";
import { shapeToResult } from "./helpers.ts";
import { merge } from "./handlers/merge.ts";
import { extractText } from "./handlers/extract-text.ts";
import { extract } from "./handlers/extract.ts";
import { csvParser } from "./handlers/csv-parser.ts";
import type { StepData, PipelineStep, StepHandler } from "./types.ts";

const handlers: Record<string, StepHandler> = {
  merge,
  "extract-text": extractText,
  extract,
  "csv-parser": csvParser,
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
        // Snapshot current data and upload as a result file for this output node
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

      const handler = handlers[step.type];
      if (!handler) throw new Error(`Unknown step: ${step.type}`);
      if (!handler.accepts.includes(data.shape)) {
        throw new Error(`${step.type} cannot accept ${data.shape}`);
      }
      data = await handler.run(data, step.config, cleanup);
    }

    await supabase.from("jobs").update({ status: "done", result_paths: resultPaths }).eq("id", jobId);

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
