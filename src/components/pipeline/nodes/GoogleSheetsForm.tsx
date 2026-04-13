"use client";

import { useState, useCallback } from "react";
import { ExternalLink, Sheet } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { usePipelineStore, type InstructionNodeData, type InstructionPayload } from "@/store/pipeline";
import { Input } from "@/components/ui/input";
import { loadPickerApi, openSheetPicker } from "@/lib/google-drive/picker";

interface GoogleSheetsFormProps {
  id: string;
  data: InstructionNodeData;
}

export function GoogleSheetsForm({ id, data }: GoogleSheetsFormProps) {
  const { updateNodeData } = useReactFlow();
  const { step, results } = usePipelineStore();
  const [picking, setPicking] = useState(false);

  const payload = data.payload as Extract<InstructionPayload, { type: "google-sheets" }>;
  const busy = step === "uploading" || step === "processing";
  const resultUrl = results[id];

  const handlePickSheet = useCallback(async () => {
    setPicking(true);
    try {
      const tokenRes = await fetch("/api/google-drive/token");
      if (!tokenRes.ok) {
        const { error } = await tokenRes.json() as { error: string };
        throw new Error(error ?? "No Drive access");
      }
      const { token } = await tokenRes.json() as { token: string };

      await loadPickerApi();
      const sheet = await openSheetPicker(token);
      if (!sheet) return;

      updateNodeData(id, {
        payload: { ...payload, sheetId: sheet.id, sheetName: sheet.name },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open sheet picker");
    } finally {
      setPicking(false);
    }
  }, [id, payload, updateNodeData]);

  return (
    <div className="flex flex-col gap-3">
      {/* Sheet picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Spreadsheet</label>
        <button
          type="button"
          onClick={handlePickSheet}
          disabled={busy || picking}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-left hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 87.3 78" className="size-3 shrink-0" aria-hidden="true">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L38 30H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
            <path d="M43.65 25L29.35 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 25.5C.4 26.9 0 28.45 0 30h38z" fill="#00AC47" />
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H49.3l8.1 15.6z" fill="#EA4335" />
            <path d="M43.65 25L57.95 0c-1.35-.8-2.85-1.2-4.4-1.2H33.8c-1.55 0-3.05.45-4.4 1.25z" fill="#00832D" />
            <path d="M87.3 30H49.3L43.65 25 29.35 0c-.05 0-.05.05-.1.05L6.6 66.85l16.15.05L49.3 30z" fill="#2684FC" />
            <path d="M73.4 30L57.95 0l-.05.05-14.3 25H87.3c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
          </svg>
          <span className={payload.sheetName ? "text-foreground truncate" : "text-muted-foreground"}>
            {picking ? "Opening..." : payload.sheetName || "Pick a spreadsheet"}
          </span>
        </button>
      </div>

      {/* Tab name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Sheet tab</label>
        <Input
          value={payload.sheetTab}
          onChange={(e) =>
            updateNodeData(id, { payload: { ...payload, sheetTab: e.target.value } })
          }
          placeholder="Sheet1"
          className="h-7 text-xs"
          disabled={busy}
        />
      </div>

      {/* Result */}
      {step === "done" && resultUrl && (
        <a
          href={resultUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Sheet className="size-3" />
          View Sheet
          <ExternalLink className="size-3" />
        </a>
      )}
      {step === "idle" && (
        <p className="text-[10px] text-muted-foreground">
          {payload.sheetId ? "Rows will be appended when pipeline runs" : "Select a spreadsheet above"}
        </p>
      )}
    </div>
  );
}
