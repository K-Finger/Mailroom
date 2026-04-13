"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import type { InstructionNodeData, InstructionPayload, PipelineFile } from "@/store/pipeline";
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

export function CsvParserForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const payload = data.payload as Extract<InstructionPayload, { type: "csv-parser" }>;
  const files = payload.file ? [payload.file.file] : [];

  const handleChange = useCallback(
    (next: File[]) => {
      const pf: PipelineFile | null = next[0]
        ? { id: crypto.randomUUID(), file: next[0], name: next[0].name }
        : null;
      updateNodeData(id, { payload: { type: "csv-parser", file: pf } });
    },
    [id, updateNodeData],
  );

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  return (
    <FileUpload
      accept=".xlsx,.xls,.csv"
      maxFiles={1}
      maxSize={10 * 1024 * 1024}
      value={files}
      onValueChange={handleChange}
      onFileReject={onFileReject}
    >
      <FileUploadDropzone className="min-h-0 py-3">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-xs font-medium">CSV with <code className="font-mono">{"{{placeholders}}"}</code></p>
          <p className="text-[10px] text-muted-foreground">XLSX · CSV</p>
          <FileUploadTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs">Browse</Button>
          </FileUploadTrigger>
        </div>
      </FileUploadDropzone>
      <FileUploadList>
        {files.map((file, i) => (
          <FileUploadItem key={i} value={file}>
            <FileUploadItemPreview />
            <FileUploadItemMetadata />
            <FileUploadItemDelete asChild>
              <Button variant="ghost" size="icon" className="size-6"><X className="size-3" /></Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  );
}
