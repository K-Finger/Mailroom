import Anthropic from "npm:@anthropic-ai/sdk@0.88.0";
import { anthropic, MODEL } from "../clients.ts";
import { downloadFile, fileToText, askClaude, inputToContent } from "../helpers.ts";
import type { StepHandler } from "../types.ts";

export const extract: StepHandler = {
  accepts: ["files", "texts"],
  produces: "table",
  async run(input, config, _cleanup) {
    const content: Anthropic.MessageParam["content"] = [];

    if (config.outputFormat === "text") {
      // Plain text output
      if (config.prompt) content.push({ type: "text", text: `Instructions: ${config.prompt}` });
      content.push({ type: "text", text: "SOURCE DATA:" });
      content.push(...await inputToContent(input));
      content.push({ type: "text", text: "Return plain text only. No JSON, no markdown fences." });

      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [{ role: "user", content }],
      });
      const text = msg.content.find((b: Anthropic.ContentBlock) => b.type === "text")?.text ?? "";
      return { shape: "texts", items: [{ name: "result", text }] };
    }

    // Structured JSON → table output
    if (config.templatePath) {
      const bytes = await downloadFile(config.templatePath);
      content.push({ type: "text", text: `TEMPLATE (match this structure):\n${await fileToText(bytes, config.templatePath)}` });
    }
    if (config.prompt) content.push({ type: "text", text: `Instructions: ${config.prompt}` });
    content.push({ type: "text", text: "SOURCE DATA:" });
    content.push(...await inputToContent(input));
    content.push({
      type: "text",
      text: `Return JSON: { "columns": [...], "rows": [{ col: value }, ...] }
Include EVERY record. Use null for missing. No markdown fences.`,
    });

    const result = await askClaude(content, { model: "claude-sonnet-4-6", maxTokens: 32768 });
    return { shape: "table", columns: result.columns, rows: result.rows };
  },
};
