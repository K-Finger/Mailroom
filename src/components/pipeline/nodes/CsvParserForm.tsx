"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import type { InstructionNodeData, InstructionPayload } from "@/store/pipeline";
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
  const localFiles = payload.file?.kind === "local" ? [payload.file.file] : [];

  const handleChange = useCallback(
    (next: File[]) => {
      const attachment = next[0]
        ? { kind: "local" as const, id: crypto.randomUUID(), file: next[0], name: next[0].name }
        : null;
      updateNodeData(id, { payload: { type: "csv-parser", file: attachment } });
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
      value={localFiles}
      onValueChange={handleChange}
      onFileReject={onFileReject}
    >
      <FileUploadDropzone className="min-h-0 py-3">
        {payload.file?.kind === "stored" ? (
          <div className="flex flex-col items-center gap-2 px-2 text-center">
            <p className="text-xs font-medium">Saved template</p>
            <p className="text-[10px] text-muted-foreground break-all">{payload.file.name}</p>
            <FileUploadTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                Replace
              </Button>
            </FileUploadTrigger>
            <button
              type="button"
              onClick={() => updateNodeData(id, { payload: { type: "csv-parser", file: null } })}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-xs font-medium">CSV with <code className="font-mono">{"{{placeholders}}"}</code></p>
            <p className="text-[10px] text-muted-foreground">XLSX Â· CSV</p>
            <FileUploadTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                Browse
              </Button>
            </FileUploadTrigger>
          </div>
        )}
      </FileUploadDropzone>
      <FileUploadList>
        {localFiles.map((file, index) => (
          <FileUploadItem key={index} value={file}>
            <FileUploadItemPreview />
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
  );
}
