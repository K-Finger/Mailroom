"use client";

import { useCallback } from "react";
import { X, AlignLeft, HelpCircle } from "lucide-react";
import { useReactFlow, useNodes, useEdges, type Node } from "@xyflow/react";
import { toast } from "sonner";
import {
  NODE_WIDTH,
  NODE_GAP,
  buildEdge,
  defaultPayload,
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
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";

export function ExtractForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const allEdges = useEdges();
  const allNodes = useNodes<PipelineNode>();
  const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
  const files = payload.file ? [payload.file.file] : [];
  const isCsv = payload.outputFormat !== "text";

  // Grey out "Text Extract First" if the immediately upstream node is already extract-text
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
      updateNodeData(id, { payload: { ...payload, file: pf } });
    },
    [id, payload, updateNodeData],
  );

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  /** Insert an extract-text node immediately before this node in the graph. */
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
      <div className="flex gap-3">
        <Textarea
          placeholder="Describe what to extract or how to format the output..."
          value={payload.text}
          onChange={(e) => updateNodeData(id, { payload: { ...payload, text: e.target.value } })}
          className={`flex-1 text-xs resize-none ${isCsv ? "h-32" : "h-28"}`}
        />
        {isCsv && (
          <FileUpload
            accept=".xlsx,.xls,.csv"
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            value={files}
            onValueChange={handleFileChange}
            onFileReject={onFileReject}
          >
            <FileUploadDropzone className="min-h-0 w-28 h-32 py-0 flex items-center justify-center">
              {files.length === 0 ? (
                <div className="flex flex-col items-center gap-1 text-center px-2">
                  <p className="text-[10px] font-medium leading-tight">Template <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <p className="text-[9px] text-muted-foreground">XLSX · CSV</p>
                  <FileUploadTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] mt-0.5">Browse</Button>
                  </FileUploadTrigger>
                </div>
              ) : (
                <FileUploadList className="w-full px-2">
                  {files.map((file, i) => (
                    <FileUploadItem key={i} value={file}>
                      <FileUploadItemPreview />
                      <FileUploadItemMetadata />
                      <FileUploadItemDelete asChild>
                        <Button variant="ghost" size="icon" className="size-5"><X className="size-2.5" /></Button>
                      </FileUploadItemDelete>
                    </FileUploadItem>
                  ))}
                </FileUploadList>
              )}
            </FileUploadDropzone>
          </FileUpload>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Output</label>
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
