"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from "@xyflow/react";
import { AlertCircle, ArrowDown, FolderOpen, Sparkles, Table2, FileText, Download, Layers, Wallet, Zap, ChevronDown, BookOpen, LogOut, Save, Pencil, Trash2, ShieldCheck, Sheet, Filter, Mail, Eye, EyeOff, Trash, RefreshCw, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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
import { SpreadsheetViewer } from "./SpreadsheetViewer";
import { TemplateEditor } from "./TemplateEditor";
import { JobHistory } from "./JobHistory";

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

const STEP_LABELS: Record<InstructionType, string> = {
  extract: "AI Extract",
  "csv-parser": "CSV Parser",
  "extract-text": "Text Extract",
  merge: "Merge",
  output: "Output",
  validator: "Validator",
  "google-sheets": "Google Sheets",
  filter: "Filter",
  email: "Email",
};

function getStepLabel(data: InstructionNodeData): string {
  if (data.instructionType === "merge") {
    const p = data.payload as Extract<InstructionPayload, { type: "merge" }>;
    return `Merge (${p.fileType.toUpperCase()})`;
  }
  return STEP_LABELS[data.instructionType];
}

// ---------------------------------------------------------------------------
// WorkflowPanel
// ---------------------------------------------------------------------------

const SHAPE_TEXT: Record<DataShape, string> = {
  files: "text-blue-600",
  texts: "text-blue-600",
  table: "text-blue-600",
};

const STEP_ICONS: Record<InstructionType, LucideIcon> = {
  extract: Sparkles,
  "csv-parser": Table2,
  "extract-text": FileText,
  merge: Layers,
  output: Download,
  validator: ShieldCheck,
  "google-sheets": Sheet,
  filter: Filter,
  email: Mail,
};

function ShapePill({ shape, error }: { shape: DataShape; error?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium",
      error ? "text-destructive" : SHAPE_TEXT[shape],
    )}>
      {shape}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Usage / Cost
// ---------------------------------------------------------------------------

const MONTHLY_LIMIT = 500;

function UsagePanel({ docs }: { docs: number }) {
  const pct = Math.min(100, Math.round((docs / MONTHLY_LIMIT) * 100));
  return (
    <a
      href="/billing"
      className="border-b px-3 py-2.5 shrink-0 flex items-center gap-3 hover:bg-accent/50 transition-colors group"
    >
      <Zap className="size-3 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Docs this month</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{docs}/{MONTHLY_LIMIT}</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </a>
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
  docs,
}: {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  docs: number;
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
      <UsagePanel docs={docs} />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Source */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <FolderOpen className="size-5 shrink-0 text-muted-foreground" />
          <span className="text-base font-semibold">Source</span>
        </div>

        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4 px-3">Connect nodes to build your workflow.</p>
        )}

        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <div key={entry.id}>
              {/* Connector */}
              <div className="flex items-center px-3 py-1.5">
                <ArrowDown className="size-4 shrink-0 text-muted-foreground/40 mr-4" />
                <ShapePill shape={entry.incomingShape} error={!!entry.error} />
              </div>

              {/* Node row */}
              <button
                onClick={() => !entry.error && onSelectNode(entry.id)}
                disabled={!!entry.error}
                className={cn(
                  "flex items-center gap-3 w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                  entry.error
                    ? "cursor-default opacity-60"
                    : "hover:bg-accent cursor-pointer",
                  selectedNodeId === entry.id && "bg-accent",
                  entry.isOutput && "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5 shrink-0", entry.error ? "text-destructive" : "text-muted-foreground")} />
                <span className="text-base truncate">{entry.label}</span>
                {entry.error && <AlertCircle className="size-5 shrink-0 text-destructive" />}
              </button>
            </div>
          );
        })}

        {/* Error */}
        {globalError && (
          <div className="mt-3 mx-1 flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
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
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"add" | "reuse">("add");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const handleTab = (next: "add" | "reuse") => {
    if (tab === next && open) { setOpen(false); return; }
    setTab(next);
    setOpen(true);
  };

  const handleSaveSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!pipelineName.trim()) return;
    onSave(pipelineName.trim());
    setPipelineName("");
    setSaveDialogOpen(false);
  };

  const handleRenameSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!renaming || !renaming.name.trim()) return;
    onRename(renaming.id, renaming.name.trim());
    setRenaming(null);
  };

  return (
    <div className="border-t bg-card shrink-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2.5">
        <button
          onClick={() => handleTab("add")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            open && tab === "add" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && tab === "add" && "rotate-180")} />
          Add
        </button>
        <button
          onClick={() => handleTab("reuse")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            open && tab === "reuse" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <BookOpen className="size-4" />
          Reuse
          {savedPipelines.length > 0 && (
            <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0 text-xs font-semibold">{savedPipelines.length}</span>
          )}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setSaveDialogOpen(true)}
          disabled={disabled}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Save className="size-4" />
          Save pipeline
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="border-t px-4 py-4 overflow-x-auto">
          {tab === "add" && (
            <div className="flex items-center gap-3">
              {INSTRUCTION_TYPES.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => onAdd(id)}
                  disabled={disabled}
                  className="flex items-center gap-3 rounded-xl border border-blue-400/50 bg-background px-5 py-3.5 hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
                >
                  <Icon className="size-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "reuse" && (
            <div className="flex items-center gap-2">
              {savedPipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved pipelines yet. Build one and hit Save.</p>
              ) : savedPipelines.map((p) => (
                <div key={p.id} className="group flex items-center gap-1 rounded-xl border border-border bg-background pl-5 pr-2 py-3.5 shrink-0">
                  <button onClick={() => onReuse(p)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <BookOpen className="size-5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">{p.name}</span>
                  </button>
                  <div className="flex items-center gap-0.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setRenaming({ id: p.id, name: p.name })}
                      className="rounded p-1.5 hover:bg-accent transition-colors"
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="rounded p-1.5 hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
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

export function Pipeline({ user, docsThisMonth, isPaid }: { user: User | null; docsThisMonth: number; isPaid: boolean }) {
  const supabase = createClient();
  const { step, jobId, error, previewData, templateEditorNodeId, setStep, setJobId, setResults, setError, setTemplateEditorNodeId } = usePipelineStore();
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>([]);

  useEffect(() => {
    supabase
      .from("saved_pipelines")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: SavedPipeline[] | null }) => { if (data) setSavedPipelines(data); });
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

    if (!user) return;

    const { data, error } = await supabase
      .from("saved_pipelines")
      .insert({ name, user_id: user.id, nodes: serialisableNodes, edges })
      .select("id, name, created_at")
      .single();
    if (error) { toast.error("Failed to save pipeline"); return; }
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
    if (error || !data) { toast.error("Failed to load pipeline"); return; }
    setNodes(data.nodes as PipelineNode[]);
    setEdges(data.edges as PipelineEdge[]);
  }, [supabase, setNodes, setEdges]);

  const [, startTransition] = useTransition();
  const busy = step === "uploading" || step === "processing";
  const sourceNode = nodes.find((n) => n.id === "source");
  const sourceData = sourceNode?.data as SourceNodeData | undefined;
  const inputFiles = useMemo(() => sourceData?.inputFiles ?? [], [sourceData]);
  const watchFolderId = sourceData?.watchFolderId;
  const watchFolderName = sourceData?.watchFolderName;
  const canSubmit = inputFiles.length > 0 && !busy && step !== "done";
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [watchers, setWatchers] = useState<Array<{ id: string; folder_name: string; enabled: boolean; last_checked_at: string | null }>>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Toast once when a job transitions to error state
  const prevStep = useRef(step);
  useEffect(() => {
    if (step === "error" && prevStep.current !== "error" && error) {
      toast.error("Pipeline failed", { description: error });
    }
    prevStep.current = step;
  }, [step, error]);

  useEffect(() => {
    if (!jobId || step === "done" || step === "error" || step === "idle") return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        async (payload: { new: { status: string; result_paths?: { nodeId: string; path: string }[]; error_message?: string } }) => {
          const job = payload.new as {
            status: string;
            result_paths?: { nodeId: string; path: string }[];
            error_message?: string;
          };
          if (job.status === "done" && job.result_paths?.length) {
            const results: Record<string, string> = {};
            await Promise.all(
              job.result_paths.map(async ({ nodeId, path }) => {
                if (path.startsWith("sheets://")) {
                  const spreadsheetId = path.slice("sheets://".length);
                  results[nodeId] = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
                } else if (path === "email://sent") {
                  results[nodeId] = "sent";
                } else {
                  const { data, error } = await supabase.storage.from("results").createSignedUrl(path, 60 * 60);
                  if (error) setError(`Failed to get download URL for result`);
                  if (data?.signedUrl) results[nodeId] = data.signedUrl;
                }
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
          if (payload.templateData && !payload.file?.file) {
            // Convert built template to a CSV file
            const { columns, rows } = payload.templateData;
            const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
            const csv = [
              columns.map(escape).join(","),
              ...rows.map((row) => columns.map((col) => escape(row[col] ?? "")).join(",")),
            ].join("\n");
            templateFiles.push({ stepIndex: i, file: new File([csv], "template.csv", { type: "text/csv" }) });
          } else if (payload.file?.file) {
            templateFiles.push({ stepIndex: i, file: payload.file.file });
          }
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
        } else if (stepType === "google-sheets") {
          const payload = data.payload as Extract<InstructionPayload, { type: "google-sheets" }>;
          config.nodeId = node.id;
          config.sheetId = payload.sheetId ?? undefined;
          config.sheetTab = payload.sheetTab;
        } else if (stepType === "validator") {
          const payload = data.payload as Extract<InstructionPayload, { type: "validator" }>;
          config.rules = payload.rules;
        } else if (stepType === "filter") {
          const payload = data.payload as Extract<InstructionPayload, { type: "filter" }>;
          config.filterRules = payload.rules;
        } else if (stepType === "email") {
          const payload = data.payload as Extract<InstructionPayload, { type: "email" }>;
          config.nodeId = node.id;
          config.emailTo = payload.to;
          config.emailSubject = payload.subject;
          config.emailBody = payload.body;
          config.emailFormat = payload.format;
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

  const handleSaveWatch = useCallback(async () => {
    if (!watchFolderId || !watchFolderName) return;
    setWatchSaving(true);
    try {
      const orderedNodes = getOrderedSteps(nodes, edges);
      const validation = validatePipeline(orderedNodes);
      if (!validation.valid) throw new Error(validation.error);

      // Upload any template files
      const templateFiles: { stepIndex: number; file: File }[] = [];
      orderedNodes.forEach((node, i) => {
        const data = node.data as InstructionNodeData;
        if (data.instructionType === "extract") {
          const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
          if (payload.templateData && !payload.file?.file) {
            const { columns, rows } = payload.templateData;
            const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
            const csv = [
              columns.map(escape).join(","),
              ...rows.map((row) => columns.map((col) => escape(row[col] ?? "")).join(",")),
            ].join("\n");
            templateFiles.push({ stepIndex: i, file: new File([csv], "template.csv", { type: "text/csv" }) });
          } else if (payload.file?.file) {
            templateFiles.push({ stepIndex: i, file: payload.file.file });
          }
        } else if (data.instructionType === "csv-parser") {
          const payload = data.payload as Extract<InstructionPayload, { type: "csv-parser" }>;
          if (payload.file?.file) templateFiles.push({ stepIndex: i, file: payload.file.file });
        }
      });

      const templatePaths = new Map<number, string>();
      if (templateFiles.length > 0) {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: templateFiles.map((t) => ({ name: t.file.name, type: t.file.type })) }),
        });
        if (!presignRes.ok) throw new Error("Failed to get upload URLs");
        const { files: signed } = await presignRes.json() as { files: Array<{ name: string; path: string; token: string }> };
        await Promise.all(
          templateFiles.map((t, i) =>
            supabase.storage.from("source-files").uploadToSignedUrl(signed[i].path, signed[i].token, t.file, { contentType: t.file.type })
          )
        );
        templateFiles.forEach((t, i) => templatePaths.set(t.stepIndex, signed[i].path));
      }

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
        } else if (stepType === "google-sheets") {
          const payload = data.payload as Extract<InstructionPayload, { type: "google-sheets" }>;
          config.nodeId = node.id;
          config.sheetId = payload.sheetId ?? undefined;
          config.sheetTab = payload.sheetTab;
        } else if (stepType === "validator") {
          const payload = data.payload as Extract<InstructionPayload, { type: "validator" }>;
          config.rules = payload.rules;
        } else if (stepType === "filter") {
          const payload = data.payload as Extract<InstructionPayload, { type: "filter" }>;
          config.filterRules = payload.rules;
        } else if (stepType === "email") {
          const payload = data.payload as Extract<InstructionPayload, { type: "email" }>;
          config.nodeId = node.id;
          config.emailTo = payload.to;
          config.emailSubject = payload.subject;
          config.emailBody = payload.body;
          config.emailFormat = payload.format;
        }
        return { type: stepType, config };
      });

      const res = await fetch("/api/drive-watchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: watchFolderId, folderName: watchFolderName, pipelineSteps }),
      });
      if (!res.ok) throw new Error("Failed to save watcher");
      toast.success(`Watching "${watchFolderName}" — new files will run automatically`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save watcher");
    } finally {
      setWatchSaving(false);
    }
  }, [watchFolderId, watchFolderName, nodes, edges, supabase]);

  const handleOpenWatchers = useCallback(async () => {
    const res = await fetch("/api/drive-watchers");
    if (res.ok) {
      const { watchers: list } = await res.json() as { watchers: typeof watchers };
      setWatchers(list);
    }
    setWatchersOpen(true);
  }, []);

  const handleDeleteWatcher = useCallback(async (id: string) => {
    await fetch(`/api/drive-watchers/${id}`, { method: "DELETE" });
    setWatchers((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleCheckNow = useCallback(async () => {
    setCheckLoading(true);
    try {
      const res = await fetch("/api/drive-watchers/check", { method: "POST" });
      const data = await res.json() as { newFiles?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      if (data.newFiles && data.newFiles > 0) {
        toast.success(`Found ${data.newFiles} new file${data.newFiles !== 1 ? "s" : ""} — processing started`);
      } else {
        toast.info("No new files found");
      }
      // Refresh watcher list to update last_checked_at
      const listRes = await fetch("/api/drive-watchers");
      if (listRes.ok) {
        const { watchers: updated } = await listRes.json() as { watchers: typeof watchers };
        setWatchers(updated ?? []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setCheckLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Shared top bar — single border-b spans full width */}
      <div className="flex items-center border-b bg-card shrink-0">
        <div className="w-72 shrink-0 px-5 py-4 border-r flex items-center gap-2.5">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="" className="h-7 w-auto shrink-0" />
            <h1 className="text-4xl font-bold tracking-tight text-blue-700">Mailroom</h1>
          </a>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 flex-1">
          <InstructionPicker onSelect={addInstructionNode} disabled={busy} />
          <Button disabled={!canSubmit} onClick={handleRun} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-10 text-sm">
            {busy ? (step === "uploading" ? "Uploading..." : "Processing...") : "Run"}
          </Button>
          {watchFolderId && (
            <Button
              variant="outline"
              onClick={handleSaveWatch}
              disabled={watchSaving || busy}
              className="h-10 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Eye className="size-4" />
              {watchSaving ? "Saving..." : "Save watch"}
            </Button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleOpenWatchers}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="size-3.5" />
            Watchers
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="size-3.5" />
            History
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none">
              {user?.email ?? "Account"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { window.location.href = "/billing"; }}>
                <Wallet className="size-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Unpaid banner */}
      {!isPaid && (
        <a
          href="/billing"
          className="flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 transition-colors px-4 py-2 text-sm font-medium text-amber-950 shrink-0"
        >
          You cannot process documents yet. Purchase access to get started.
          <span className="underline font-semibold">Go to billing</span>
        </a>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col">
          <WorkflowPanel
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            docs={docsThisMonth}
          />
        </div>

        {/* Right side */}
        <div className="flex-1 flex flex-col min-w-0">

        {/* Spreadsheet viewer — replaces canvas when preview is active */}
        {previewData && (
          <div className="flex-1 min-h-0">
            <SpreadsheetViewer />
          </div>
        )}

        {/* Template editor — replaces canvas when editing an extract template */}
        {templateEditorNodeId && !previewData && (() => {
          const node = nodes.find((n) => n.id === templateEditorNodeId);
          const payload = node ? (node.data as InstructionNodeData).payload as Extract<InstructionPayload, { type: "extract" }> : null;
          return (
            <div className="flex-1 min-h-0">
              <TemplateEditor
                initialData={payload?.templateData ?? null}
                onSave={(data) => {
                  setNodes((nds) => nds.map((n) =>
                    n.id === templateEditorNodeId
                      ? { ...n, data: { ...n.data, payload: { ...(n.data as InstructionNodeData).payload, templateData: data, file: null } } }
                      : n
                  ));
                  setTemplateEditorNodeId(null);
                }}
                onClose={() => setTemplateEditorNodeId(null)}
              />
            </div>
          );
        })()}

        {/* Canvas + node tray — hidden while previewing or editing template */}
        <div className={cn("flex-1 min-h-0 flex flex-col", (previewData || templateEditorNodeId) && "hidden")}>
          <div className={cn(
            "flex-1 min-h-0",
            step === "processing" && "pipeline-processing",
            step === "done" && "pipeline-done"
          )}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange as OnNodesChange}
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
              <Controls
                className="rounded-xl! border! border-foreground/20! bg-background! shadow-md! gap-0! p-1! [&>button]:rounded-lg [&>button]:bg-transparent [&>button]:border-none! [&>button]:text-foreground [&>button]:shadow-none! [&>button]:w-10! [&>button]:h-10! [&>button]:p-2.5! [&>button_svg]:w-5! [&>button_svg]:h-5!"
              />
              {inputFiles.length === 0 && step === "idle" && (
                <Panel position="top-center" className="pointer-events-none mt-6">
                  <p className="text-xs text-muted-foreground bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-sm">
                    Drop files into <strong>Source</strong>, add steps below, then hit <strong>Run</strong>
                  </p>
                </Panel>
              )}
            </ReactFlow>
          </div>
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

      <JobHistory open={historyOpen} onOpenChange={setHistoryOpen} />

      {/* Watchers dialog */}
      <Dialog open={watchersOpen} onOpenChange={setWatchersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="size-4" />
                Drive watchers
              </span>
              {watchers.length > 0 && (
                <button
                  type="button"
                  onClick={handleCheckNow}
                  disabled={checkLoading}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 font-normal"
                >
                  {checkLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  {checkLoading ? "Checking..." : "Check now"}
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {watchers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No watchers yet. Pick a folder in the Source node and click &quot;Save watch&quot;.
              </p>
            ) : (
              watchers.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <Eye className="size-4 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.folder_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.last_checked_at
                        ? `Last checked ${new Date(w.last_checked_at).toLocaleString()}`
                        : "Not checked yet"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWatcher(w.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
