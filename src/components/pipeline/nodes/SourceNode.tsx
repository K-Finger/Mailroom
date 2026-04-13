"use client";

import { X, FolderOpen } from "lucide-react";
import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { toast } from "sonner";
import { usePipelineStore, type PipelineFile, type SourceNodeData, type PipelineNode } from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { loadPickerApi, openFolderPicker, listFolderFiles, downloadDriveFile } from "@/lib/google-drive/picker";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { pdfThumbnail } from "@/lib/pdf-thumbnail";

export function SourceNode({ id, data }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow();
  const { step } = usePipelineStore();
  const { inputFiles } = data as SourceNodeData;
  const busy = step === "uploading" || step === "processing";
  const files = inputFiles.map((f) => f.file);
  const [driveLoading, setDriveLoading] = useState(false);

  const handleChange = useCallback(
    async (next: File[]) => {
      // Process sequentially so only one PDF is decoded in memory at a time
      const pipelineFiles: PipelineFile[] = [];
      for (const f of next) {
        const existing = inputFiles.find((pf) => pf.file === f);
        if (existing) { pipelineFiles.push(existing); continue; }

        let thumbnail: string | undefined;
        if (f.name.toLowerCase().endsWith(".pdf")) {
          try { thumbnail = await pdfThumbnail(f); } catch { /* fall back to no thumbnail */ }
        }
        pipelineFiles.push({ id: crypto.randomUUID(), file: f, name: f.name, thumbnail });
      }
      updateNodeData(id, { inputFiles: pipelineFiles });
    },
    [id, updateNodeData, inputFiles]
  );

  const handleDrivePick = useCallback(async () => {
    setDriveLoading(true);
    try {
      const tokenRes = await fetch("/api/google-drive/token");
      if (!tokenRes.ok) {
        const { error } = await tokenRes.json() as { error: string };
        throw new Error(error ?? "No Drive access");
      }
      const { token } = await tokenRes.json() as { token: string };

      await loadPickerApi();
      const folder = await openFolderPicker(token);
      if (!folder) return;

      const driveFiles = await listFolderFiles(folder.id, token);
      if (!driveFiles.length) {
        toast.error("No supported files in that folder", { description: "Supports PDF, XLSX, XLS, CSV" });
        return;
      }

      const downloaded = await Promise.all(driveFiles.map((f) => downloadDriveFile(f, token)));
      await handleChange([...files, ...downloaded]);
      toast.success(`Added ${downloaded.length} file${downloaded.length !== 1 ? "s" : ""} from "${folder.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Drive files");
    } finally {
      setDriveLoading(false);
    }
  }, [files, handleChange]);

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  return (
    <div className="w-48 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Source</span>
      </div>
      <div className="px-4 pb-4 nodrag nopan">
        <FileUpload
          accept=".pdf,.xlsx,.xls,.csv"
          maxFiles={20}
          maxSize={50 * 1024 * 1024}
          value={files}
          onValueChange={handleChange}
          onFileReject={onFileReject}
          disabled={busy}
          multiple
        >
          <FileUploadDropzone className="min-h-0 py-4 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-medium">Drop files</p>
              <p className="text-[10px] text-muted-foreground">PDF · XLSX · CSV</p>
              <FileUploadTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-4 text-xs" disabled={busy}>
                  Browse
                </Button>
              </FileUploadTrigger>
            </div>
          </FileUploadDropzone>
          <button
            type="button"
            onClick={handleDrivePick}
            disabled={busy || driveLoading}
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg viewBox="0 0 87.3 78" className="size-3 shrink-0" aria-hidden="true">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L38 30H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
              <path d="M43.65 25L29.35 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 25.5C.4 26.9 0 28.45 0 30h38z" fill="#00AC47" />
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H49.3l8.1 15.6z" fill="#EA4335" />
              <path d="M43.65 25L57.95 0c-1.35-.8-2.85-1.2-4.4-1.2H33.8c-1.55 0-3.05.45-4.4 1.25z" fill="#00832D" />
              <path d="M87.3 30H49.3L43.65 25 29.35 0c-.05 0-.05.05-.1.05L6.6 66.85l16.15.05L49.3 30z" fill="#2684FC" />
              <path d="M73.4 30L57.95 0l-.05.05-14.3 25H87.3c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
            </svg>
            {driveLoading ? "Loading..." : "Google Drive"}
          </button>
          <FileUploadList className="mt-2">
            {inputFiles.map((pf) => (
              <FileUploadItem key={pf.id} value={pf.file}>
                {pf.thumbnail ? (
                  <img
                    src={pf.thumbnail}
                    alt={pf.name}
                    className="size-10 rounded object-cover shrink-0 border border-border"
                  />
                ) : (
                  <FileUploadItemPreview />
                )}
                <FileUploadItemMetadata />
                <FileUploadItemDelete asChild>
                  <Button variant="ghost" size="icon" className="size-6">
                    <X className="size-3" />
                  </Button>
                </FileUploadItemDelete>
              </FileUploadItem>
            ))}
          </FileUploadList>
        </FileUpload>
      </div>
      <Handle type="source" position={Position.Right} className="bg-foreground/40! border-0! w-4! h-4!" />
    </div>
  );
}
