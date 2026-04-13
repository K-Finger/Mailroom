import { downloadFile, askClaude, inputToContent } from "../helpers.ts";
import type { StepHandler } from "../types.ts";

export const csvParser: StepHandler = {
  accepts: ["files", "texts"],
  produces: "table",
  async run(input, config, _cleanup) {
    if (!config.templatePath) throw new Error("csv-parser requires template");

    const templateBytes = await downloadFile(config.templatePath);
    const templateText = new TextDecoder().decode(templateBytes);
    const headers = templateText.trim().split("\n")[0].split(",").map((h) => h.trim());
    const placeholders = headers.filter((h) => /^\{\{.+\}\}$/.test(h));

    if (placeholders.length === 0) throw new Error("No {{placeholders}} in template");

    const cleanHeaders = headers.map((h) => /^\{\{(.+)\}\}$/.test(h) ? h.slice(2, -2).trim() : h);

    const content = [
      { type: "text" as const, text: `CSV columns: ${headers.join(", ")}\nFill placeholders: ${placeholders.join(", ")}` },
      { type: "text" as const, text: "SOURCE DATA:" },
      ...await inputToContent(input),
      {
        type: "text" as const,
        text: `Return JSON: { "columns": ${JSON.stringify(cleanHeaders)}, "rows": [...] }
Fill placeholders from source. Static columns = null. No markdown fences.`,
      },
    ];

    const result = await askClaude(content);
    return { shape: "table", columns: result.columns, rows: result.rows };
  },
};
