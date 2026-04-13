// @ts-expect-error no type declarations for npm:pdf-lib in Deno LSP
import { PDFDocument } from "npm:pdf-lib";
import { supabase } from "../clients.ts";
import { downloadFile } from "../helpers.ts";
import type { StepHandler } from "../types.ts";

export const merge: StepHandler = {
  accepts: ["files"],
  produces: "files",
  async run(input, config, cleanup) {
    if (input.shape !== "files") throw new Error("merge requires files");

    const fileType = (config.fileType ?? "pdf").toLowerCase();

    if (fileType === "pdf") {
      const merged = await PDFDocument.create();
      const dropped: { path: string; name: string }[] = [];

      for (let i = 0; i < input.paths.length; i++) {
        const name = input.names[i];
        if (!name.toLowerCase().endsWith(".pdf")) {
          dropped.push({ path: input.paths[i], name });
          continue;
        }
        const bytes = await downloadFile(input.paths[i]);
        const pdf = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        (pages as unknown[]).forEach((page) => merged.addPage(page));
      }

      if (merged.getPageCount() === 0) throw new Error("No PDF files found to merge");

      const mergedBytes = await merged.save();
      const mergedPath = `temp/${crypto.randomUUID()}/merged.pdf`;

      const { error } = await supabase.storage
        .from("source-files")
        .upload(mergedPath, mergedBytes, { contentType: "application/pdf" });

      if (error) throw new Error(`Failed to upload merged PDF: ${error.message}`);
      cleanup.add(mergedPath);

      return {
        shape: "files",
        paths: [mergedPath, ...dropped.map((f) => f.path)],
        names: ["merged.pdf", ...dropped.map((f) => f.name)],
      };
    }

    throw new Error(`Merge file type "${fileType}" is not yet supported`);
  },
};
