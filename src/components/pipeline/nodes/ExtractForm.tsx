"use client";

import { useCallback } from "react";
import { X, AlignLeft, HelpCircle, Pencil, Upload, Table2 } from "lucide-react";
import { useReactFlow, useNodes, useEdges, type Node } from "@xyflow/react";
import { toast } from "sonner";
import {
  NODE_WIDTH,
  NODE_GAP,
  buildEdge,
  defaultPayload,
  usePipelineStore,
  type InstructionNodeData,
  type InstructionPayload,
  type PipelineFile,
  type PipelineNode,
} from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileUpload,
  FileUploadTrigger,
} from "@/components/ui/file-upload";

export function ExtractForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { setTemplateEditorNodeId } = usePipelineStore();
  const allEdges = useEdges();
  const allNodes = useNodes<PipelineNode>();
  const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
  const files = payload.file ? [payload.file.file] : [];
  const isCsv = payload.outputFormat !== "text";

  const incomingEdge = allEdges.find((e) => e.target === id);
  const upstreamNode = incomingEdge ? allNodes.find((n) => n.id === incomingEdge.source) : null;
  const upstreamIsExtractText =
    upstreamNode?.data?.kind === "instruction" &&
    (upstreamNode.data as InstructionNodeData).instructionType === "extract-text";

  const handleFileChange = useCallback(
    (next: File[]) => {
      const pf: PipelineFile | null = next[0]
        ? { id: crypto.randomUUID(), file: next[0], name: next[0].name }
        : null;
      updateNodeData(id, { payload: { ...payload, file: pf, templateData: pf ? null : payload.templateData } });
    },
    [id, payload, updateNodeData],
  );

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  const clearTemplate = useCallback(() => {
    updateNodeData(id, { payload: { ...payload, templateData: null, file: null } });
  }, [id, payload, updateNodeData]);

  const handleInsertExtractText = useCallback(() => {
    const edge = getEdges().find((e) => e.target === id);
    if (!edge) return;
    const thisNode = getNodes().find((n) => n.id === id);
    if (!thisNode) return;
    const newId = crypto.randomUUID();
    const insertX = thisNode.position.x;
    setNodes((nds) => [
      ...nds.map((n) =>
        n.position.x >= insertX
          ? { ...n, position: { ...n.position, x: n.position.x + NODE_WIDTH + NODE_GAP } }
          : n
      ),
      {
        id: newId,
        type: "instructionNode",
        position: { x: insertX, y: thisNode.position.y },
        data: { kind: "instruction", instructionType: "extract-text", payload: defaultPayload("extract-text"), collapsed: false },
        draggable: true,
      } as Node,
    ]);
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== edge.id),
      buildEdge(edge.source, newId),
      buildEdge(newId, id),
    ]);
  }, [id, getNodes, getEdges, setNodes, setEdges]);

  return (
    <div className="flex flex-col gap-3">
      {/* Prompt */}
      <Textarea
        placeholder="Describe what to extract or how to format the output..."
        value={payload.text}
        onChange={(e) => updateNodeData(id, { payload: { ...payload, text: e.target.value } })}
        className="text-xs resize-none h-28"
      />

      {/* Template box — only for Table output */}
      {isCsv && (
        <>
          {payload.templateData ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center gap-2">
              <p className="flex-1 text-xs text-muted-foreground truncate">
                {payload.templateData.columns.join(", ")}
              </p>
              <button
                onClick={() => setTemplateEditorNodeId(id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Pencil className="size-3" />
                Edit
              </button>
              <button onClick={clearTemplate} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="size-3" />
              </button>
            </div>
          ) : files.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center gap-2">
              <Upload className="size-3 text-muted-foreground shrink-0" />
              <p className="flex-1 text-xs text-muted-foreground truncate">{files[0].name}</p>
              <button onClick={clearTemplate} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border overflow-hidden flex">
              <button
                onClick={() => setTemplateEditorNodeId(id)}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <Table2 className="size-4" />
                <span className="text-xs font-medium">Build template</span>
              </button>
              <div className="w-px bg-border" />
              <FileUpload
                accept=".xlsx,.xls,.csv"
                maxFiles={1}
                maxSize={10 * 1024 * 1024}
                value={[]}
                onValueChange={handleFileChange}
                onFileReject={onFileReject}
                className="flex-1"
              >
                <FileUploadTrigger asChild>
                  <button className="w-full flex flex-col items-center gap-1.5 py-3 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                    <Upload className="size-4" />
                    <span className="text-xs font-medium">Upload template</span>
                  </button>
                </FileUploadTrigger>
              </FileUpload>
            </div>
          )}
        </>
      )}

      {/* Output dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Output format</label>
        <Select
          value={payload.outputFormat}
          onValueChange={(val) =>
            updateNodeData(id, { payload: { ...payload, outputFormat: val as "csv" | "text", file: val === "text" ? null : payload.file } })
          }
        >
          <SelectTrigger size="sm" className="flex-1 text-xs h-7">
            <SelectValue>{(v: string) => v === "text" ? "Text" : "Table"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">Table</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Text Extract First */}
      {isCsv && (
        <div className="flex items-center gap-1.5 w-fit">
          <button
            type="button"
            onClick={handleInsertExtractText}
            disabled={upstreamIsExtractText}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <AlignLeft className="size-3.5 shrink-0" />
            Text Extract First
          </button>
          <Tooltip>
            <TooltipTrigger className="flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              <HelpCircle className="size-3 mt-px" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-48 text-xs">
              Inserts a Text Extract node before this step. Useful when AI extraction works better on plain text than raw files.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
