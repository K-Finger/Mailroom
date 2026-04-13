"use client";

import { X, FolderOpen, Mail, Loader2, Paperclip } from "lucide-react";
import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { toast } from "sonner";
import { usePipelineStore, type PipelineFile, type SourceNodeData, type PipelineNode } from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { GmailMessage } from "@/lib/gmail/api";

export function SourceNode({ id, data }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow();
  const { step } = usePipelineStore();
  const { inputFiles } = data as SourceNodeData;
  const busy = step === "uploading" || step === "processing";
  const files = inputFiles.map((f) => f.file);
  const [driveLoading, setDriveLoading] = useState(false);
  const [gmailOpen, setGmailOpen] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [gmailQuery, setGmailQuery] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());

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

  const handleGmailOpen = useCallback(async () => {
    setGmailOpen(true);
    setGmailLoading(true);
    setSelectedAttachments(new Set());
    try {
      const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(gmailQuery)}`);
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      const { messages } = await res.json() as { messages: GmailMessage[] };
      setGmailMessages(messages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch emails");
      setGmailOpen(false);
    } finally {
      setGmailLoading(false);
    }
  }, [gmailQuery]);

  const handleGmailSearch = useCallback(async () => {
    setGmailLoading(true);
    try {
      const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(gmailQuery)}`);
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      const { messages } = await res.json() as { messages: GmailMessage[] };
      setGmailMessages(messages);
      setSelectedAttachments(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to search emails");
    } finally {
      setGmailLoading(false);
    }
  }, [gmailQuery]);

  const toggleAttachment = useCallback((key: string) => {
    setSelectedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleGmailImport = useCallback(async () => {
    if (selectedAttachments.size === 0) return;
    setGmailLoading(true);
    try {
      const downloads: File[] = [];
      for (const key of selectedAttachments) {
        const [messageId, attachmentId, filename, mimeType] = key.split("|");
        const url = `/api/gmail/attachment?messageId=${messageId}&attachmentId=${attachmentId}&filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(mimeType)}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        downloads.push(new File([blob], filename, { type: mimeType }));
      }
      await handleChange([...files, ...downloads]);
      toast.success(`Added ${downloads.length} attachment${downloads.length !== 1 ? "s" : ""} from Gmail`);
      setGmailOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import attachments");
    } finally {
      setGmailLoading(false);
    }
  }, [selectedAttachments, files, handleChange]);

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  return (
    <div className="w-48 rounded-xl border border-blue-400/50 bg-card shadow-sm">
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
          <button
            type="button"
            onClick={handleGmailOpen}
            disabled={busy || gmailLoading}
            className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Mail className="size-3 shrink-0 text-brand" />
            Gmail Inbox
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

      {/* Gmail picker dialog */}
      <Dialog open={gmailOpen} onOpenChange={setGmailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-brand" />
              Import from Gmail
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Search emails (e.g., invoice, from:vendor@...)"
              value={gmailQuery}
              onChange={(e) => setGmailQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGmailSearch()}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleGmailSearch} disabled={gmailLoading}>
              {gmailLoading ? <Loader2 className="size-3 animate-spin" /> : "Search"}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2">
            {gmailLoading && gmailMessages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading emails...
              </div>
            ) : gmailMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No emails with attachments found.
              </div>
            ) : (
              gmailMessages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium truncate">{msg.subject || "(No subject)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{msg.from}</div>
                  <div className="space-y-1">
                    {msg.attachments.map((att) => {
                      const key = `${msg.id}|${att.id}|${att.filename}|${att.mimeType}`;
                      return (
                        <label
                          key={att.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAttachments.has(key)}
                            onCheckedChange={() => toggleAttachment(key)}
                          />
                          <Paperclip className="size-3 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate flex-1">{att.filename}</span>
                          <span className="text-xs text-muted-foreground">
                            {(att.size / 1024).toFixed(0)} KB
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setGmailOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGmailImport}
              disabled={selectedAttachments.size === 0 || gmailLoading}
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {gmailLoading ? (
                <Loader2 className="size-3 animate-spin mr-2" />
              ) : null}
              Import {selectedAttachments.size > 0 ? `(${selectedAttachments.size})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
