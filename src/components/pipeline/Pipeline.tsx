"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type NodeTypes,
  type OnConnect,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from "@xyflow/react";
import { AlertCircle, ArrowDown, FolderOpen, Sparkles, Table2, FileText, Download, Layers, Wallet, Zap, ChevronDown, BookOpen, LogOut, Save, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/auth/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  usePipelineStore,
  INITIAL_NODES,
  INITIAL_EDGES,
  NODE_WIDTH,
  NODE_GAP,
  buildEdge,
  defaultPayload,
  producedShape,
  STEP_IO,
  type DataShape,
  type PipelineStep,
  type StepType,
  type SourceNodeData,
  type InstructionNodeData,
  type InstructionPayload,
  type InstructionType,
  type PipelineNode,
  type PipelineEdge,
} from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InstructionPicker, INSTRUCTION_TYPES } from "./instruction-picker";
import { SourceNode } from "./nodes/SourceNode";
import { InstructionNode } from "./nodes/InstructionNode";

const nodeTypes: NodeTypes = {
  sourceNode: SourceNode,
  instructionNode: InstructionNode,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk the full graph source → end, including output nodes. */
function getOrderedSteps(nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] {
  const edgeMap = new Map(edges.map((e) => [e.source, e.target]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ordered: PipelineNode[] = [];
  let currentId: string | undefined = "source";
  while (currentId) {
    const nextId = edgeMap.get(currentId);
    if (!nextId) break;
    const node = nodeMap.get(nextId);
    if (!node) break;
    if (node.data.kind === "instruction") ordered.push(node);
    currentId = nextId;
  }
  return ordered;
}

function validatePipeline(nodes: PipelineNode[]): { valid: boolean; error?: string } {
  let currentShape: DataShape = "files";
  for (const node of nodes) {
    const data = node.data as InstructionNodeData;
    const type = data.instructionType as StepType;
    const io = STEP_IO[type];
    if (!io.accepts.includes(currentShape)) {
      return { valid: false, error: `${type} cannot accept ${currentShape} data` };
    }
    currentShape = producedShape(type, data.payload, currentShape);
  }
  return { valid: true };
}

function getStepLabel(data: InstructionNodeData): string {
  if (data.instructionType === "merge") {
    const p = data.payload as Extract<InstructionPayload, { type: "merge" }>;
    return `Merge (${p.fileType.toUpperCase()})`;
  }
  const labels: Partial<Record<InstructionType, string>> = {
    extract: "AI Extract",
    "csv-parser": "CSV Parser",
    "extract-text": "Text Extract",
    output: "Output",
  };
  return labels[data.instructionType] ?? data.instructionType;
}

// ---------------------------------------------------------------------------
// WorkflowPanel
// ---------------------------------------------------------------------------

const SHAPE_STYLES: Record<DataShape, string> = {
  files: "bg-muted text-muted-foreground",
  texts: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  table: "bg-primary/10 text-primary",
};

const STEP_ICONS: Record<InstructionType, LucideIcon> = {
  extract: Sparkles,
  "csv-parser": Table2,
  "extract-text": FileText,
  merge: Layers,
  output: Download,
};

function ShapePill({ shape, error }: { shape: DataShape; error?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium",
      error ? "text-destructive" : SHAPE_STYLES[shape].split(" ")[1],
    )}>
      {shape}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Usage / Cost
// ---------------------------------------------------------------------------

export interface UsageData {
  /** Account balance in USD. */
  balance: number;
  /** Estimated cost of the current workflow run in USD. */
  estimatedCost: number;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function UsagePanel({ usage }: { usage: UsageData }) {
  return (
    <div className="border-b px-3 py-3 shrink-0 grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2">
        <Wallet className="size-3 text-muted-foreground" />
        <span className="text-sm font-semibold tabular-nums">{fmt(usage.balance)}</span>
        <span className="text-[10px] text-muted-foreground">Balance</span>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-primary/5 px-3 py-2">
        <Zap className="size-3 text-primary" />
        <span className="text-sm font-semibold tabular-nums text-primary">{fmt(usage.estimatedCost)}</span>
        <span className="text-[10px] text-muted-foreground">Est. pipeline cost</span>
      </div>
    </div>
  );
}

interface WorkflowEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  incomingShape: DataShape;
  isOutput: boolean;
  error?: string;
}

function WorkflowPanel({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  usage,
}: {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  usage: UsageData;
}) {
  const orderedNodes = getOrderedSteps(nodes, edges);
  const entries: WorkflowEntry[] = [];
  let currentShape: DataShape = "files";
  let globalError: string | null = null;

  for (const node of orderedNodes) {
    const data = node.data as InstructionNodeData;
    const stepType = data.instructionType as StepType;
    const io = STEP_IO[stepType];
    const incomingShape = currentShape;
    const canAccept = io.accepts.includes(currentShape);

    entries.push({
      id: node.id,
      label: getStepLabel(data),
      icon: STEP_ICONS[data.instructionType] ?? Sparkles,
      incomingShape,
      isOutput: data.instructionType === "output",
      error: canAccept ? undefined : `Cannot accept "${currentShape}"`,
    });

    if (!canAccept) {
      globalError = `${getStepLabel(data)} cannot accept ${currentShape} data`;
      break;
    }

    currentShape = producedShape(stepType, data.payload, currentShape);
  }

  return (
    <div className="flex flex-col h-full border-r bg-card">
      <UsagePanel usage={usage} />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Source */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Source</span>
        </div>

        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground mt-4 px-2">Connect nodes to build your workflow.</p>
        )}

        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <div key={entry.id}>
              {/* Connector */}
              <div className="flex items-center gap-2 px-2 py-1">
                <ArrowDown className="size-3 shrink-0 text-muted-foreground/40" />
                <ShapePill shape={entry.incomingShape} error={!!entry.error} />
              </div>

              {/* Node row */}
              <button
                onClick={() => !entry.error && onSelectNode(entry.id)}
                disabled={!!entry.error}
                className={cn(
                  "flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 transition-colors",
                  entry.error
                    ? "cursor-default opacity-60"
                    : "hover:bg-accent cursor-pointer",
                  selectedNodeId === entry.id && "bg-accent",
                  entry.isOutput && "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-3.5 shrink-0", entry.error ? "text-destructive" : "text-muted-foreground")} />
                <span className="text-sm truncate">{entry.label}</span>
                {entry.error && <AlertCircle className="size-3.5 shrink-0 text-destructive ml-auto" />}
              </button>
            </div>
          );
        })}

        {/* Error */}
        {globalError && (
          <div className="mt-3 mx-1 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>{globalError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeTray (accordion with Add / Reuse tabs)
// ---------------------------------------------------------------------------

interface SavedPipeline {
  id: string;
  name: string;
  created_at: string;
}

function NodeTray({
  onAdd,
  onReuse,
  onSave,
  onDelete,
  onRename,
  disabled,
  savedPipelines,
}: {
  onAdd: (type: InstructionType) => void;
  onReuse: (pipeline: SavedPipeline) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  disabled: boolean;
  savedPipelines: SavedPipeline[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"add" | "reuse">("add");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const handleTab = (next: "add" | "reuse") => {
    if (tab === next && open) { setOpen(false); return; }
    setTab(next);
    setOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineName.trim()) return;
    onSave(pipelineName.trim());
    setPipelineName("");
    setSaveDialogOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming || !renaming.name.trim()) return;
    onRename(renaming.id, renaming.name.trim());
    setRenaming(null);
  };

  return (
    <div className="border-t bg-card shrink-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          onClick={() => handleTab("add")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            open && tab === "add" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <ChevronDown className={cn("size-3 transition-transform", open && tab === "add" && "rotate-180")} />
          Add
        </button>
        <button
          onClick={() => handleTab("reuse")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            open && tab === "reuse" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <BookOpen className="size-3" />
          Reuse
          {savedPipelines.length > 0 && (
            <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0 text-[10px] font-semibold">{savedPipelines.length}</span>
          )}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setSaveDialogOpen(true)}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Save className="size-3" />
          Save pipeline
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="border-t px-3 py-3 overflow-x-auto">
          {tab === "add" && (
            <div className="flex items-center gap-2">
              {INSTRUCTION_TYPES.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => onAdd(id)}
                  disabled={disabled}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
                >
                  <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "reuse" && (
            <div className="flex items-center gap-2">
              {savedPipelines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved pipelines yet. Build one and hit Save.</p>
              ) : savedPipelines.map((p) => (
                <div key={p.id} className="group flex items-center gap-1 rounded-lg border border-border bg-background pl-3 pr-1.5 py-1.5 shrink-0">
                  <button onClick={() => onReuse(p)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium whitespace-nowrap">{p.name}</span>
                  </button>
                  <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setRenaming({ id: p.id, name: p.name })}
                      className="rounded p-1 hover:bg-accent transition-colors"
                    >
                      <Pencil className="size-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="rounded p-1 hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => { if (!o) setRenaming(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename pipeline</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="Pipeline name"
              value={renaming?.name ?? ""}
              onChange={(e) => setRenaming((r) => r ? { ...r, name: e.target.value } : null)}
              autoFocus
            />
            <DialogFooter>
              <Button type="submit" disabled={!renaming?.name.trim()}>Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Save pipeline</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="Pipeline name"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button type="submit" disabled={!pipelineName.trim()}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function Pipeline({ user }: { user: User | null }) {
  const supabase = createClient();
  const { step, jobId, setStep, setJobId, setResults, setError } = usePipelineStore();
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>([]);

  useEffect(() => {
    supabase
      .from("saved_pipelines")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSavedPipelines(data); });
  }, [supabase]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => {
      const filtered = eds.filter((e) => e.source !== connection.source);
      return addEdge(connection, filtered);
    }),
    [setEdges]
  );

  const addInstructionNode = useCallback(
    (type: InstructionType) => {
      setNodes((nds) => {
        const rightmost = nds.reduce((max, n) => n.position.x > max.position.x ? n : max, nds[0]);
        const newX = rightmost.position.x;
        const newId = crypto.randomUUID();

        const shifted = nds.map((n) =>
          n.position.x >= newX
            ? { ...n, position: { ...n.position, x: n.position.x + NODE_WIDTH + NODE_GAP } }
            : n
        );

        const newNode: PipelineNode = {
          id: newId,
          type: "instructionNode",
          position: { x: newX, y: 0 },
          data: { kind: "instruction", instructionType: type, payload: defaultPayload(type), collapsed: false },
          draggable: true,
        };

        setEdges((eds) => {
          const targetId = nds.find((n) => n.position.x >= newX)?.id ?? rightmost.id;
          const sourceId = eds.find((e) => e.target === targetId)?.source ?? "source";
          return eds
            .filter((e) => !(e.source === sourceId && e.target === targetId))
            .concat([buildEdge(sourceId, newId), buildEdge(newId, targetId)]);
        });

        return [...shifted, newNode];
      });
    },
    [setNodes, setEdges]
  );

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (rfInstance) {
      rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 1 });
    }
  }, [rfInstance]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.data.kind === "instruction") {
      setSelectedNodeId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, [setEdges]);

  const handleSavePipeline = useCallback(async (name: string) => {
    // Strip non-serializable File objects before persisting
    const serialisableNodes = nodes.map((n) => {
      if (n.data.kind === "source") {
        return { ...n, data: { ...n.data, inputFiles: [] } };
      }
      const d = n.data as InstructionNodeData;
      const payload = { ...d.payload } as Record<string, unknown>;
      if ("file" in payload) payload.file = null;
      return { ...n, data: { ...d, payload } };
    });

    if (!user) { console.error("Not logged in"); return; }

    const { data, error } = await supabase
      .from("saved_pipelines")
      .insert({ name, user_id: user.id, nodes: serialisableNodes, edges })
      .select("id, name, created_at")
      .single();
    if (error) { console.error("Save failed", error.message, error.details); return; }
    setSavedPipelines((prev) => [data, ...prev]);
  }, [supabase, user, nodes, edges]);

  const handleDeletePipeline = useCallback(async (id: string) => {
    await supabase.from("saved_pipelines").delete().eq("id", id);
    setSavedPipelines((prev) => prev.filter((p) => p.id !== id));
  }, [supabase]);

  const handleRenamePipeline = useCallback(async (id: string, name: string) => {
    await supabase.from("saved_pipelines").update({ name }).eq("id", id);
    setSavedPipelines((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  }, [supabase]);

  const handleReusePipeline = useCallback(async (pipeline: SavedPipeline) => {
    const { data, error } = await supabase
      .from("saved_pipelines")
      .select("nodes, edges")
      .eq("id", pipeline.id)
      .single();
    if (error || !data) { console.error("Load failed", error); return; }
    setNodes(data.nodes as PipelineNode[]);
    setEdges(data.edges as PipelineEdge[]);
  }, [supabase, setNodes, setEdges]);

  const busy = step === "uploading" || step === "processing";
  const sourceNode = nodes.find((n) => n.id === "source");
  const inputFiles = useMemo(
    () => (sourceNode?.data as SourceNodeData)?.inputFiles ?? [],
    [sourceNode?.data],
  );
  const canSubmit = inputFiles.length > 0 && !busy && step !== "done";

  useEffect(() => {
    if (!jobId || step === "done" || step === "error" || step === "idle") return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        async (payload) => {
          const job = payload.new as {
            status: string;
            result_paths?: { nodeId: string; path: string }[];
            error_message?: string;
          };
          if (job.status === "done" && job.result_paths?.length) {
            const results: Record<string, string> = {};
            await Promise.all(
              job.result_paths.map(async ({ nodeId, path }) => {
                const { data, error } = await supabase.storage.from("results").createSignedUrl(path, 60 * 5);
                if (error) console.error("createSignedUrl failed", path, error);
                if (data?.signedUrl) results[nodeId] = data.signedUrl;
              })
            );
            setResults(results);
            setStep("done");
          } else if (job.status === "error") {
            setError(job.error_message ?? "Processing failed");
            setStep("error");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId, step, supabase, setStep, setResults, setError]);

  const handleRun = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);

    try {
      const orderedNodes = getOrderedSteps(nodes, edges);
      const validation = validatePipeline(orderedNodes);
      if (!validation.valid) throw new Error(validation.error);

      setStep("uploading");

      const sourceFiles = inputFiles.map((f) => f.file);
      const templateFiles: { stepIndex: number; file: File }[] = [];

      orderedNodes.forEach((node, i) => {
        const data = node.data as InstructionNodeData;
        if (data.instructionType === "extract") {
          const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
          if (payload.file?.file) templateFiles.push({ stepIndex: i, file: payload.file.file });
        } else if (data.instructionType === "csv-parser") {
          const payload = data.payload as Extract<InstructionPayload, { type: "csv-parser" }>;
          if (payload.file?.file) templateFiles.push({ stepIndex: i, file: payload.file.file });
        }
      });

      const allFiles = [...sourceFiles, ...templateFiles.map((t) => t.file)];

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: allFiles.map((f) => ({ name: f.name, type: f.type })) }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URLs");
      const { files: signed } = await presignRes.json() as { files: Array<{ name: string; path: string; token: string }> };

      await Promise.all(
        allFiles.map((file, i) =>
          supabase.storage.from("source-files").uploadToSignedUrl(signed[i].path, signed[i].token, file, { contentType: file.type })
        )
      );

      const templatePaths = new Map<number, string>();
      templateFiles.forEach((t, i) => {
        templatePaths.set(t.stepIndex, signed[sourceFiles.length + i].path);
      });

      const pipelineSteps: PipelineStep[] = orderedNodes.map((node, i) => {
        const data = node.data as InstructionNodeData;
        const stepType = data.instructionType as StepType;
        const config: PipelineStep["config"] = {};

        if (stepType === "extract") {
          const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
          if (payload.text) config.prompt = payload.text;
          if (templatePaths.has(i)) config.templatePath = templatePaths.get(i);
          config.outputFormat = payload.outputFormat;
        } else if (stepType === "csv-parser") {
          if (templatePaths.has(i)) config.templatePath = templatePaths.get(i);
        } else if (stepType === "merge") {
          const payload = data.payload as Extract<InstructionPayload, { type: "merge" }>;
          config.fileType = payload.fileType;
        } else if (stepType === "output") {
          const payload = data.payload as Extract<InstructionPayload, { type: "output" }>;
          config.nodeId = node.id;
          config.tableFormat = payload.tableFormat;
        } else if (stepType === "validator") {
          const payload = data.payload as Extract<InstructionPayload, { type: "validator" }>;
          config.rules = payload.rules;
        }

        return { type: stepType, config };
      });

      setStep("processing");
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputPaths: signed.slice(0, sourceFiles.length).map((f) => f.path),
          inputNames: signed.slice(0, sourceFiles.length).map((f) => f.name),
          pipelineSteps,
        }),
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      const { jobId: id } = await jobRes.json() as { jobId: string };
      setJobId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }, [canSubmit, nodes, edges, inputFiles, supabase, setStep, setError, setJobId]);

  return (
    <div className="flex flex-col h-full">
      {/* Shared top bar — single border-b spans full width */}
      <div className="flex items-center border-b bg-card shrink-0">
        <div className="w-72 shrink-0 px-4 py-2 border-r">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workflow</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 flex-1">
          <InstructionPicker onSelect={addInstructionNode} disabled={busy} />
          <Button size="sm" disabled={!canSubmit} onClick={handleRun}>
            {busy ? (step === "uploading" ? "Uploading..." : "Processing...") : "Run"}
          </Button>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none">
              {user?.email ?? "Account"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col">
          <WorkflowPanel
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            usage={{ balance: 12.40, estimatedCost: 0.03 }}
          />
        </div>

        {/* Right side */}
        <div className="flex-1 flex flex-col min-w-0">

        {/* Canvas */}
        <div className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onEdgeClick={onEdgeClick}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.9}
            translateExtent={[[-400, -300], [2000, 800]]}
            edgesReconnectable={false}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "color-mix(in oklch, var(--foreground) 30%, transparent)", strokeWidth: 2 },
              interactionWidth: 20,
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-30" />
            <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground" />
          </ReactFlow>
        </div>

        {/* Node tray */}
        <NodeTray
          onAdd={addInstructionNode}
          onReuse={handleReusePipeline}
          onSave={handleSavePipeline}
          onDelete={handleDeletePipeline}
          onRename={handleRenamePipeline}
          disabled={busy}
          savedPipelines={savedPipelines}
        />
        </div>
      </div>
    </div>
  );
}
