export async function pdfThumbnail(file: File, width = 200): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const scale = width / viewport.width;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    // Release canvas backing store
    canvas.width = 0;
    canvas.height = 0;

    return dataUrl;
  } finally {
    // Always release the decoded PDF from memory
    await pdf.destroy();
  }
}
