"use client";

import { Download, Loader2 } from "lucide-react";
import { useReactFlow, useNodes, useEdges } from "@xyflow/react";
import {
  usePipelineStore,
  INITIAL_NODES,
  INITIAL_EDGES,
  producedShape,
  STEP_IO,
  type DataShape,
  type SourceNodeData,
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
  const edges = useEdges();
  const reverseMap = new Map(edges.map((e) => [e.target, e.source]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build ordered path from source → nodeId (exclusive)
  const path: string[] = [];
  let cur: string | undefined = nodeId;
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
  const { step, results, error, reset } = usePipelineStore();
  const { setNodes, setEdges, updateNodeData, getNode } = useReactFlow();
  const nodes = useNodes<PipelineNode>();
  const hasFiles = nodes.some(
    (n) => n.data.kind === "source" && (n.data as SourceNodeData).inputFiles.length > 0,
  );
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

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Format picker — only when idle and upstream produces table data */}
      {step === "idle" && isTable && (
        <div className="flex items-center gap-2 w-full">
          <label className="text-xs text-muted-foreground shrink-0">Format</label>
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

      {step === "idle" && (
        <p className="text-xs text-muted-foreground">{hasFiles ? "Ready to run" : "Add source files"}</p>
      )}
      {busy && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {step === "uploading" ? "Uploading..." : "Processing..."}
        </div>
      )}
      {step === "done" && resultUrl && (
        <a href={resultUrl} download>
          <Button size="sm" variant="outline" className="h-8 px-4 text-xs gap-2">
            <Download className="size-3" />
            Download
          </Button>
        </a>
      )}
      {step === "error" && (
        <p className="text-xs text-destructive">{error ?? "Failed"}</p>
      )}
      {(step === "done" || step === "error") && (
        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Start over
        </button>
      )}
    </div>
  );
}
