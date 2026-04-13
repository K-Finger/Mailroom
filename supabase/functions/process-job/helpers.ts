import Anthropic from "npm:@anthropic-ai/sdk@0.88.0";
import ExcelJS from "npm:exceljs";
import { supabase, anthropic, MODEL } from "./clients.ts";
import type { StepData } from "./types.ts";

export async function downloadFile(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from("source-files").download(path);
  if (error) throw new Error(`Download failed: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Extract plain text from a file based on its extension. */
export async function fileToText(bytes: Uint8Array, name: string): Promise<string> {
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { extractText } = await import("npm:unpdf");
    return (await extractText(bytes)).text;
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`## ${sheet.name}`);
      sheet.eachRow((row) => {
        const vals = (row.values as unknown[]).slice(1);
        lines.push(vals.map((v) => v ?? "").join(","));
      });
    });
    return lines.join("\n");
  }

  return new TextDecoder().decode(bytes);
}

/** Send content to Claude and parse the JSON response. */
export async function askClaude(
  content: Anthropic.MessageParam["content"],
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content }],
  });
  const raw = msg.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(raw.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim());
}

export function rowsToXlsx(columns: string[], rows: Record<string, unknown>[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");
  sheet.addRow(columns);
  rows.forEach((r) => sheet.addRow(columns.map((c) => r[c] ?? null)));
  return workbook.xlsx.writeBuffer().then((b) => new Uint8Array(b as ArrayBuffer));
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): Uint8Array {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    columns.map(escape).join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ];
  return new TextEncoder().encode(lines.join("\n"));
}

/** Serialise StepData to bytes for upload as a result file. */
export async function shapeToResult(
  data: StepData,
  tableFormat: "xlsx" | "csv" = "xlsx",
): Promise<{ bytes: Uint8Array; filename: string; contentType: string }> {
  if (data.shape === "table") {
    if (tableFormat === "csv") {
      return {
        bytes: rowsToCsv(data.columns, data.rows),
        filename: "result.csv",
        contentType: "text/csv",
      };
    }
    return {
      bytes: await rowsToXlsx(data.columns, data.rows),
      filename: "result.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  if (data.shape === "texts") {
    return {
      bytes: new TextEncoder().encode(JSON.stringify(data.items, null, 2)),
      filename: "result.json",
      contentType: "application/json",
    };
  }
  // files — single file passthrough or zip
  if (data.paths.length === 1) {
    const ext = data.names[0].split(".").pop() ?? "bin";
    return {
      bytes: await downloadFile(data.paths[0]),
      filename: `result.${ext}`,
      contentType: "application/octet-stream",
    };
  }
  // @ts-expect-error no type declarations for npm:jszip in Deno LSP
  const JSZip = (await import("npm:jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < data.paths.length; i++) {
    zip.file(data.names[i], await downloadFile(data.paths[i]));
  }
  return {
    bytes: await zip.generateAsync({ type: "uint8array" }),
    filename: "result.zip",
    contentType: "application/zip",
  };
}

/** Convert StepData to text content blocks for Claude. */
export async function inputToContent(input: StepData): Promise<Anthropic.MessageParam["content"]> {
  const blocks: Anthropic.MessageParam["content"] = [];
  if (input.shape === "files") {
    for (let i = 0; i < input.paths.length; i++) {
      const bytes = await downloadFile(input.paths[i]);
      const name = input.names[i];
      blocks.push({ type: "text", text: `### ${name}\n${await fileToText(bytes, name)}` });
    }
  } else if (input.shape === "texts") {
    for (const item of input.items) {
      blocks.push({ type: "text", text: `### ${item.name}\n${item.text}` });
    }
  }
  return blocks;
}
