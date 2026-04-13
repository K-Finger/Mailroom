import { downloadFile, fileToText } from "../helpers.ts";
import type { StepHandler } from "../types.ts";

export const extractText: StepHandler = {
  accepts: ["files"],
  produces: "texts",
  async run(input, _config, _cleanup) {
    if (input.shape !== "files") throw new Error("extract-text requires files");
    const items: { name: string; text: string }[] = [];

    for (let i = 0; i < input.paths.length; i++) {
      const bytes = await downloadFile(input.paths[i]);
      const name = input.names[i];
      items.push({ name, text: await fileToText(bytes, name) });
    }
    return { shape: "texts", items };
  },
};
