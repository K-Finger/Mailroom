"use client";

import { X, FolderOpen } from "lucide-react";
import { useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { toast } from "sonner";
import { usePipelineStore, type PipelineFile, type SourceNodeData, type PipelineNode } from "@/store/pipeline";
import { Button } from "@/components/ui/button";
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

  const handleChange = useCallback(
    async (next: File[]) => {
      const pipelineFiles: PipelineFile[] = await Promise.all(
        next.map(async (f): Promise<PipelineFile> => {
          // Reuse existing entry if already processed
          const existing = inputFiles.find((pf) => pf.file === f);
          if (existing) return existing;

          let thumbnail: string | undefined;
          if (f.name.toLowerCase().endsWith(".pdf")) {
            try {
              thumbnail = await pdfThumbnail(f);
            } catch {
              // silently fall back to no thumbnail
            }
          }
          return { id: crypto.randomUUID(), file: f, name: f.name, thumbnail };
        })
      );
      updateNodeData(id, { inputFiles: pipelineFiles });
    },
    [id, updateNodeData, inputFiles]
  );

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
