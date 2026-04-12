import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.88.0";
import ExcelJS from "npm:exceljs";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadFile(path: string, bucket: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Convert spreadsheet bytes → plain text table for Claude */
async function spreadsheetToText(bytes: Uint8Array, name: string): Promise<string> {
  const lower = name.toLowerCase();

  if (lower.endsWith(".csv")) {
    return new TextDecoder().decode(bytes);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);

  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`## Sheet: ${sheet.name}`);
    sheet.eachRow((row) => {
      const values = (row.values as ExcelJS.CellValue[]).slice(1);
      lines.push(values.map((v) => (v == null ? "" : String(v))).join(","));
    });
  });

  return lines.join("\n");
}

/** Build a Claude content block from a file */
async function fileContentBlock(
  bytes: Uint8Array,
  name: string,
  nativePdf = false,
): Promise<Anthropic.MessageParam["content"][number]> {
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    if (nativePdf) {
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const b64 = btoa(binary);
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: b64 },
      } as unknown as Anthropic.MessageParam["content"][number];
    }

    // Default: extract text first (cheaper, faster)
    const { extractText } = await import("npm:unpdf");
    const { text } = await extractText(bytes);
    return { type: "text", text: `### File: ${name}\n\n${text}` };
  }

  const isSpreadsheet =
    lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv");
  const text = isSpreadsheet
    ? await spreadsheetToText(bytes, name)
    : new TextDecoder().decode(bytes);

  return { type: "text", text: `### File: ${name}\n\n${text}` };
}

/** Convert Claude's JSON rows → XLSX buffer */
async function rowsToXlsx(
  rows: Record<string, unknown>[],
  columns: string[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");

  sheet.addRow(columns);
  for (const row of rows) {
    sheet.addRow(columns.map((col) => row[col] ?? null));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const { jobId, nativePdf = false } = await req.json() as { jobId: string; nativePdf?: boolean };

  await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) throw new Error("Job not found");

    const content: Anthropic.MessageParam["content"] = [];

    if (job.instruction_path) {
      const bytes = await downloadFile(job.instruction_path, "source-files");
      const baseName = job.instruction_path.split("/").pop() ?? "template";
      content.push({
        type: "text",
        text: "The following file is the OUTPUT TEMPLATE. Your response must match this structure exactly — same column names, same data types.",
      });
      content.push(await fileContentBlock(bytes, baseName, nativePdf));
    }

    if (job.instruction_text) {
      content.push({ type: "text", text: `Additional instructions: ${job.instruction_text}` });
    }

    content.push({
      type: "text",
      text: "The following files are the SOURCE DATA to extract from:",
    });
    for (let i = 0; i < job.input_paths.length; i++) {
      const bytes = await downloadFile(job.input_paths[i], "source-files");
      content.push(await fileContentBlock(bytes, job.input_names[i] ?? `file_${i}`, nativePdf));
    }

    content.push({
      type: "text",
      text: `Extract all data from the source files and return it as a JSON object matching this exact schema:
{
  "columns": ["col1", "col2", ...],
  "rows": [
    { "col1": "value", "col2": "value" },
    ...
  ]
}

Rules:
- Column names must exactly match the template (or be reasonable if no template given)
- Include EVERY record as its own row — never deduplicate, even if rows appear identical
- If a value or section repeats across pages or documents, still include it as a separate row
- Do not summarise, truncate, merge, or skip any records
- Use null for missing values
- Return only the JSON object, no markdown fences`,
    });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    });

    const rawText = message.content.find((b) => b.type === "text")?.text ?? "";
    const jsonText = rawText.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim();
    const { columns, rows } = JSON.parse(jsonText) as {
      columns: string[];
      rows: Record<string, unknown>[];
    };

    const xlsxBytes = await rowsToXlsx(rows, columns);
    const resultPath = `${job.user_id}/${jobId}/result.xlsx`;

    const { error: uploadError } = await supabase.storage
      .from("results")
      .upload(resultPath, xlsxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) throw new Error(`Result upload failed: ${uploadError.message}`);

    await supabase
      .from("jobs")
      .update({ status: "done", result_path: resultPath })
      .eq("id", jobId);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("jobs")
      .update({ status: "error", error_message: message })
      .eq("id", jobId);

    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
