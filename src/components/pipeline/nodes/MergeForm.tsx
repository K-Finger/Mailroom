"use client";

import { useReactFlow } from "@xyflow/react";
import type { InstructionNodeData, InstructionPayload } from "@/store/pipeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MergeForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const payload = data.payload as Extract<InstructionPayload, { type: "merge" }>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">File type</label>
        <Select
          value={payload.fileType}
          onValueChange={(val) => updateNodeData(id, { payload: { ...payload, fileType: val as "pdf" } })}
        >
          <SelectTrigger size="sm" className="flex-1 text-xs h-7">
            <SelectValue>{(v: string) => v.toUpperCase()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[10px] text-muted-foreground">Other file types will be passed to the next step unchanged.</p>
    </div>
  );
}
