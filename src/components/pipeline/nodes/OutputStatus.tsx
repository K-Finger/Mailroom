"use client";

import { useState } from "react";
import { Download, Loader2, AlertTriangle, Table2 } from "lucide-react";
import { useReactFlow, useNodes, useEdges, type Edge } from "@xyflow/react";
import * as XLSX from "xlsx";
import {
  usePipelineStore,
  producedShape,
  STEP_IO,
  type DataShape,
  type PipelineNode,
  type InstructionNodeData,
  type InstructionPayload,
  type StepType,
} from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Walk backwards from nodeId to compute the shape arriving at it. */
function useIncomingShape(nodeId: string): DataShape {
  const nodes = useNodes<PipelineNode>();
  const edges = useEdges<Edge>();
  const reverseMap = new Map<string, string>(edges.map((e) => [e.target, e.source]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const path: string[] = [];
  let cur: string = nodeId;
  while (cur) {
    const prev = reverseMap.get(cur);
    if (!prev || prev === "source") break;
    path.unshift(prev);
    cur = prev;
  }

  let shape: DataShape = "files";
  for (const nid of path) {
    const node = nodeMap.get(nid);
    if (!node || node.data.kind !== "instruction") continue;
    const d = node.data as InstructionNodeData;
    const stepType = d.instructionType as StepType;
    if (STEP_IO[stepType]) shape = producedShape(stepType, d.payload, shape);
  }
  return shape;
}

export function OutputStatus({ id }: { id: string }) {
  const { step, results, error, setPreviewData } = usePipelineStore();
  const { updateNodeData, getNode } = useReactFlow();
  const [previewing, setPreviewing] = useState(false);
  const busy = step === "uploading" || step === "processing";
  const resultUrl = results[id];
  const incomingShape = useIncomingShape(id);
  const isTable = incomingShape === "table";

  const node = getNode(id);
  const payload = (node?.data as InstructionNodeData)?.payload as Extract<InstructionPayload, { type: "output" }>;
  const tableFormat = payload?.tableFormat ?? "xlsx";

  const handleReset = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    reset();
  };

  const handlePreview = async () => {
    if (!resultUrl) return;
    setPreviewing(true);
    try {
      const res = await fetch(resultUrl);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      if (raw.length === 0) return;
      const [header, ...dataRows] = raw;
      const columns = header.map(String);
      const rows = dataRows.map((row) =>
        Object.fromEntries(columns.map((col, i) => [col, String(row[i] ?? "")]))
      );
      setPreviewData({ name: sheetName, columns, rows });
    } catch {
      // silently fail — download still works
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {step === "idle" && isTable && (
        <div className="flex items-center gap-2 w-full">
          <label className="text-xs text-muted-foreground shrink-0">File type</label>
          <Select
            value={tableFormat}
            onValueChange={(val) =>
              updateNodeData(id, { payload: { ...payload, tableFormat: val as "xlsx" | "csv" } })
            }
          >
            <SelectTrigger size="sm" className="flex-1 text-xs h-7">
              <SelectValue>{(v: string) => v.toUpperCase()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">XLSX</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {step === "uploading" ? "Uploading..." : "Processing..."}
        </div>
      )}
      {step === "done" && resultUrl && (
        <div className="flex items-center gap-2 flex-wrap">
          <a href={resultUrl} download>
            <Button size="sm" variant="outline" className="h-8 px-4 text-xs gap-2">
              <Download className="size-3" />
              Download
            </Button>
          </a>
          {isTable && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-4 text-xs gap-2"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Table2 className="size-3" />
              )}
              Preview
            </Button>
          )}
        </div>
      )}
      {step === "error" && (
        <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5 w-full">
          <AlertTriangle className="size-3 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-snug">{error ?? "Processing failed"}</p>
        </div>
      )}
    </div>
  );
}
