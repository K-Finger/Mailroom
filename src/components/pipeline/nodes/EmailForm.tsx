"use client";

import { Mail, CheckCircle } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { usePipelineStore, type InstructionNodeData, type InstructionPayload } from "@/store/pipeline";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EmailForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const { step, results } = usePipelineStore();
  const payload = data.payload as Extract<InstructionPayload, { type: "email" }>;
  const busy = step === "uploading" || step === "processing";
  const sent = results[id] === "sent";

  const patch = (fields: Partial<typeof payload>) =>
    updateNodeData(id, { payload: { ...payload, ...fields } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          type="email"
          placeholder="recipient@example.com"
          value={payload.to}
          onChange={(e) => patch({ to: e.target.value })}
          className="h-7 text-xs"
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Subject</label>
        <Input
          placeholder="Pipeline results"
          value={payload.subject}
          onChange={(e) => patch({ subject: e.target.value })}
          className="h-7 text-xs"
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Message (optional)</label>
        <Textarea
          placeholder="Add a note..."
          value={payload.body}
          onChange={(e) => patch({ body: e.target.value })}
          className="text-xs min-h-[60px] resize-none"
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Attachment format</label>
        <Select
          value={payload.format}
          onValueChange={(v) => patch({ format: v as "xlsx" | "csv" })}
          disabled={busy}
        >
          <SelectTrigger size="sm" className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xlsx">XLSX</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {step === "done" && sent && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle className="size-3" />
          Email sent
        </div>
      )}

      {step === "idle" && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Mail className="size-3" />
          {payload.to ? `Will send to ${payload.to}` : "Enter a recipient above"}
        </div>
      )}
    </div>
  );
}
