"use client";

import { X, ChevronDown, ChevronUp, Sparkles, Table2, Mic, Download, Loader2, Info } from "lucide-react";
import { useCallback } from "react";
import { Handle, Position, useReactFlow, useNodes, type NodeProps } from "@xyflow/react";
import { toast } from "sonner";
import {
  usePipelineStore,
  INITIAL_NODES,
  INITIAL_EDGES,
  type InstructionNodeData,
  type InstructionPayload,
  type PipelineFile,
  type PipelineNode,
  type SourceNodeData,
} from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const TYPE_META = {
  extract:      { icon: Sparkles,  label: "AI Extract",  collapsible: true,  hasContent: true  },
  "csv-parser": { icon: Table2,    label: "CSV Parser",  collapsible: true,  hasContent: true  },
  transcribe:   { icon: Mic,       label: "Transcribe",  collapsible: false, hasContent: false },
  output:       { icon: Download,  label: "Output",      collapsible: false, hasContent: true  },
};

function extractWidth(text: string): number {
  const longest = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  return Math.min(480, Math.max(320, longest * 7 + 64));
}

export function InstructionNode({ id, data }: NodeProps<PipelineNode>) {
  const { updateNodeData, setNodes, setEdges, getEdges } = useReactFlow();
  const { step } = usePipelineStore();
  const d = data as InstructionNodeData;
  const busy = step === "uploading" || step === "processing";
  const { icon: Icon, label, collapsible, hasContent } = TYPE_META[d.instructionType];

  const width = d.instructionType === "extract"
    ? extractWidth((d.payload as Extract<InstructionPayload, { type: "extract" }>).text)
    : 192;

  const toggle = useCallback(() => {
    updateNodeData(id, { collapsed: !d.collapsed });
  }, [id, d.collapsed, updateNodeData]);

  const remove = useCallback(() => {
    const edges = getEdges();
    const sourceEdge = edges.find((e) => e.target === id);
    const targetEdge = edges.find((e) => e.source === id);
    const reconnected = sourceEdge && targetEdge
      ? [{ ...sourceEdge, target: targetEdge.target, id: `${sourceEdge.source}->${targetEdge.target}` }]
      : [];
    setEdges(edges.filter((e) => e.source !== id && e.target !== id).concat(reconnected));
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [id, getEdges, setEdges, setNodes]);

  return (
    <Collapsible open={!d.collapsed}>
      <div
        className="shrink-0 rounded-xl border border-border bg-card shadow-sm transition-[width] duration-150"
        style={{ width }}
      >
        <Handle type="target" position={Position.Left} className="bg-foreground/30! border-0! w-3! h-3!" />

        <div className="flex items-center gap-2 px-4 py-3">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">{label}</span>
          {collapsible && (
            <Button variant="ghost" size="icon" className="size-6" disabled={busy} onClick={toggle}>
              {d.collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={remove}
          >
            <X className="size-3" />
          </Button>
        </div>

        {collapsible && hasContent && (
          <CollapsibleContent>
            <div className="border-t border-border px-4 py-4 nodrag nopan">
              {d.instructionType === "extract" && <ExtractForm id={id} data={d} />}
              {d.instructionType === "csv-parser" && <CsvParserForm id={id} data={d} />}
            </div>
          </CollapsibleContent>
        )}

        {!collapsible && hasContent && d.instructionType === "output" && (
          <div className="border-t border-border px-4 py-4 nodrag nopan">
            <OutputStatus />
          </div>
        )}

        <Handle type="source" position={Position.Right} className="bg-foreground/30! border-0! w-3! h-3!" />
      </div>
    </Collapsible>
  );
}

function ExtractForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
  const files = payload.file ? [payload.file.file] : [];

  const handleFileChange = useCallback(
    (next: File[]) => {
      const pf: PipelineFile | null = next[0]
        ? { id: crypto.randomUUID(), file: next[0], name: next[0].name }
        : null;
      updateNodeData(id, { payload: { ...payload, file: pf } });
    },
    [id, payload, updateNodeData]
  );

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, { description: `"${file.name}" was rejected` });
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <Textarea
          placeholder="Describe what to extract or how to format the output..."
          value={payload.text}
          onChange={(e) => updateNodeData(id, { payload: { ...payload, text: e.target.value } })}
          className="flex-1 h-36 text-xs resize-none"
        />
        <FileUpload
          accept=".xlsx,.xls,.csv"
          maxFiles={1}
          maxSize={10 * 1024 * 1024}
          value={files}
          onValueChange={handleFileChange}
          onFileReject={onFileReject}
        >
          <FileUploadDropzone className="min-h-0 w-28 h-36 py-0 flex items-center justify-center">
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
      </div>
      <ExtractTextToggle
        nativePdf={payload.nativePdf}
        onToggle={() => updateNodeData(id, { payload: { ...payload, nativePdf: !payload.nativePdf } })}
      />
    </div>
  );
}

function ExtractTextToggle({ nativePdf, onToggle }: { nativePdf: boolean; onToggle: () => void }) {
  const checked = !nativePdf;
  return (
    <div className="flex items-center gap-2 pt-1 pl-2 pr-1">
      <Popover>
        <PopoverTrigger className="flex items-center leading-none p-0">
          <Info className="size-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="max-w-56 text-xs p-3">
          <p className="text-muted-foreground">Pulls plain text from the PDF before AI parsing, faster and cheaper.</p>
          <p className="text-muted-foreground mt-2">Turn off to send the raw PDF directly. Better for complex layouts and tables, but uses more tokens.</p>
        </PopoverContent>
      </Popover>
      <span className="text-sm text-muted-foreground leading-none">Extract Text First</span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-foreground" : "bg-input"}`}
      >
        <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${checked ? "translate-x-3" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function OutputStatus() {
  const { step, resultUrl, error, reset } = usePipelineStore();
  const { setNodes, setEdges } = useReactFlow();
  const nodes = useNodes<PipelineNode>();
  const hasFiles = nodes.some(
    (n) => n.data.kind === "source" && (n.data as SourceNodeData).inputFiles.length > 0
  );
  const busy = step === "uploading" || step === "processing";

  const handleReset = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    reset();
  };

  return (
    <div className="flex flex-col items-start gap-2">
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
        <a href={resultUrl} download="result.xlsx">
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


function CsvParserForm({ id, data }: { id: string; data: InstructionNodeData }) {
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
    [id, updateNodeData]
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
