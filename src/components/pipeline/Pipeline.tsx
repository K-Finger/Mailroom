"use client";

import Link from "next/link";
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
import {
  AlertCircle,
  ArrowDown,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Sparkles,
  Table2,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  buildPipelineSteps,
  collectLocalTemplateUploads,
  getOrderedSteps,
  hydratePersistedNodes,
  sanitizeNodesForPersistence,
  validatePipeline,
  type PersistedTemplateAttachment,
  type SavedPipelineRecord,
  type TemplateStorageRef,
} from "@/lib/pipeline/workflow";
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
  type StepType,
  type SourceNodeData,
  type InstructionNodeData,
  type InstructionPayload,
  type InstructionType,
  type PipelineNode,
  type PipelineEdge,
} from "@/store/pipeline";
import { buttonVariants, Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InstructionPicker, INSTRUCTION_TYPES } from "./instruction-picker";
import { SourceNode } from "./nodes/SourceNode";
import { InstructionNode } from "./nodes/InstructionNode";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const nodeTypes: NodeTypes = {
  sourceNode: SourceNode,
  instructionNode: InstructionNode,
};

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
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium",
        error ? "text-destructive" : SHAPE_STYLES[shape].split(" ")[1],
      )}
    >
      {shape}
    </span>
  );
}

export interface UsageData {
  balance: number;
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
              <div className="flex items-center gap-2 px-2 py-1">
                <ArrowDown className="size-3 shrink-0 text-muted-foreground/40" />
                <ShapePill shape={entry.incomingShape} error={!!entry.error} />
              </div>

              <button
                onClick={() => !entry.error && onSelectNode(entry.id)}
                disabled={!!entry.error}
                className={cn(
                  "flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 transition-colors",
                  entry.error ? "cursor-default opacity-60" : "hover:bg-accent cursor-pointer",
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

function NodeTray({
  onAdd,
  disabled,
}: {
  onAdd: (type: InstructionType) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t bg-card overflow-x-auto shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0 mr-1">
        Add
      </span>
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
  );
}

function withSourceFiles(nodes: PipelineNode[], sourceFiles: SourceNodeData["inputFiles"]) {
  return nodes.map<PipelineNode>((node) =>
    node.id === "source"
      ? { ...node, data: { kind: "source", inputFiles: sourceFiles } as SourceNodeData }
      : node,
  );
}

export function Pipeline({ initialPipelines }: { initialPipelines: SavedPipelineRecord[] }) {
  const supabase = createClient();
  const { step, jobId, reset, setStep, setJobId, setResults, setError } = usePipelineStore();
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<PipelineNode, PipelineEdge> | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savedPipelines, setSavedPipelines] = useState(initialPipelines);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [savingPipeline, setSavingPipeline] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) => {
        const filtered = eds.filter((edge) => edge.source !== connection.source);
        return addEdge(connection, filtered);
      }),
    [setEdges],
  );

  const addInstructionNode = useCallback(
    (type: InstructionType) => {
      setNodes((nds) => {
        const rightmost = nds.reduce((max, node) => (node.position.x > max.position.x ? node : max), nds[0]);
        const newX = rightmost.position.x;
        const newId = crypto.randomUUID();

        const shifted = nds.map((node) =>
          node.position.x >= newX
            ? { ...node, position: { ...node.position, x: node.position.x + NODE_WIDTH + NODE_GAP } }
            : node,
        );

        const newNode: PipelineNode = {
          id: newId,
          type: "instructionNode",
          position: { x: newX, y: 0 },
          data: { kind: "instruction", instructionType: type, payload: defaultPayload(type), collapsed: false },
          draggable: true,
        };

        setEdges((eds) => {
          const targetId = nds.find((node) => node.position.x >= newX)?.id ?? rightmost.id;
          const sourceId = eds.find((edge) => edge.target === targetId)?.source ?? "source";
          return eds
            .filter((edge) => !(edge.source === sourceId && edge.target === targetId))
            .concat([buildEdge(sourceId, newId), buildEdge(newId, targetId)]);
        });

        return [...shifted, newNode];
      });
      setActivePipelineId(null);
    },
    [setNodes, setEdges],
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      if (rfInstance) {
        rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 1 });
      }
    },
    [rfInstance],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.data.kind === "instruction") {
      setSelectedNodeId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setEdges((eds) => eds.filter((candidate) => candidate.id !== edge.id));
      setActivePipelineId(null);
    },
    [setEdges],
  );

  const busy = step === "uploading" || step === "processing";
  const sourceNode = nodes.find((node) => node.id === "source");
  const inputFiles = useMemo(
    () => (sourceNode?.data as SourceNodeData)?.inputFiles ?? [],
    [sourceNode?.data],
  );
  const canSubmit = inputFiles.length > 0 && !busy && step !== "done";

  const activePipeline = useMemo(
    () => savedPipelines.find((pipeline) => pipeline.id === activePipelineId) ?? null,
    [savedPipelines, activePipelineId],
  );

  useEffect(() => {
    if (!jobId || step === "done" || step === "error" || step === "idle") {
      return;
    }

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
                if (error) {
                  console.error("createSignedUrl failed", path, error);
                }
                if (data?.signedUrl) {
                  results[nodeId] = data.signedUrl;
                }
              }),
            );
            setResults(results);
            setStep("done");
          } else if (job.status === "error") {
            setError(job.error_message ?? "Processing failed");
            setStep("error");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, step, supabase, setStep, setResults, setError]);

  const updateSavedPipelineList = useCallback((savedPipeline: SavedPipelineRecord) => {
    setSavedPipelines((current) => {
      const remaining = current.filter((pipeline) => pipeline.id !== savedPipeline.id);
      return [savedPipeline, ...remaining];
    });
  }, []);

  const applySavedPipeline = useCallback(
    (savedPipeline: SavedPipelineRecord, preserveSourceFiles: boolean) => {
      const hydratedNodes = hydratePersistedNodes(savedPipeline.nodes);
      const nextNodes = preserveSourceFiles
        ? withSourceFiles(hydratedNodes, inputFiles)
        : hydratedNodes;

      setNodes(nextNodes);
      setEdges(savedPipeline.edges);
      setSelectedNodeId(null);
      setActivePipelineId(savedPipeline.id);
      reset();
    },
    [inputFiles, setNodes, setEdges, reset],
  );

  const openSaveDialog = useCallback(() => {
    setPipelineName(activePipeline?.name ?? "Untitled pipeline");
    setSaveDialogOpen(true);
  }, [activePipeline]);

  const handleCreateNew = useCallback(() => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setSelectedNodeId(null);
    setActivePipelineId(null);
    reset();
  }, [setNodes, setEdges, reset]);

  const handleLoadSavedPipeline = useCallback(
    (pipelineId: string) => {
      if (!pipelineId) {
        return;
      }
      const savedPipeline = savedPipelines.find((pipeline) => pipeline.id === pipelineId);
      if (!savedPipeline) {
        return;
      }

      applySavedPipeline(savedPipeline, false);
      toast.success(`Loaded "${savedPipeline.name}"`);
    },
    [savedPipelines, applySavedPipeline],
  );

  const handleSavePipeline = useCallback(async () => {
    const trimmedName = pipelineName.trim();
    if (!trimmedName) {
      toast.error("Pipeline name is required");
      return;
    }

    try {
      setSavingPipeline(true);
      const orderedNodes = getOrderedSteps(nodes, edges);
      const validation = validatePipeline(orderedNodes);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const localTemplateUploads = collectLocalTemplateUploads(orderedNodes);
      const persistedTemplateOverrides = new Map<string, PersistedTemplateAttachment>();
      const templateStorageRefs = new Map<string, TemplateStorageRef>();

      if (localTemplateUploads.length > 0) {
        const presignResponse = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "pipeline-assets",
            files: localTemplateUploads.map((upload) => ({
              name: upload.file.name,
              type: upload.file.type,
            })),
          }),
        });

        if (!presignResponse.ok) {
          throw new Error("Failed to stage pipeline template files");
        }

        const { files: signed } = (await presignResponse.json()) as {
          files: Array<{ name: string; path: string; token: string }>;
        };

        await Promise.all(
          localTemplateUploads.map((upload, index) =>
            supabase.storage
              .from("pipeline-assets")
              .uploadToSignedUrl(signed[index].path, signed[index].token, upload.file, {
                contentType: upload.file.type,
              }),
          ),
        );

        localTemplateUploads.forEach((upload, index) => {
          const ref: PersistedTemplateAttachment = {
            id: crypto.randomUUID(),
            name: upload.name,
            path: signed[index].path,
            bucket: "pipeline-assets",
          };
          persistedTemplateOverrides.set(upload.nodeId, ref);
          templateStorageRefs.set(upload.nodeId, {
            name: ref.name,
            path: ref.path,
            bucket: ref.bucket,
          });
        });
      }

      const payload = {
        id: activePipelineId ?? undefined,
        name: trimmedName,
        nodes: sanitizeNodesForPersistence(nodes, persistedTemplateOverrides),
        edges,
        pipelineSteps: buildPipelineSteps(orderedNodes, templateStorageRefs),
      };

      const response = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save pipeline");
      }

      const { pipeline } = (await response.json()) as { pipeline: SavedPipelineRecord };
      updateSavedPipelineList(pipeline);
      applySavedPipeline(pipeline, true);
      setSaveDialogOpen(false);
      toast.success(`Saved "${pipeline.name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save pipeline");
    } finally {
      setSavingPipeline(false);
    }
  }, [
    activePipelineId,
    applySavedPipeline,
    edges,
    nodes,
    pipelineName,
    setSavingPipeline,
    supabase.storage,
    updateSavedPipelineList,
  ]);

  const handleRun = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setError(null);

    try {
      const orderedNodes = getOrderedSteps(nodes, edges);
      const validation = validatePipeline(orderedNodes);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setStep("uploading");

      const sourceFiles = inputFiles.map((file) => file.file);
      const localTemplateUploads = collectLocalTemplateUploads(orderedNodes);
      const allFiles = [...sourceFiles, ...localTemplateUploads.map((upload) => upload.file)];

      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "source-files",
          files: allFiles.map((file) => ({ name: file.name, type: file.type })),
        }),
      });
      if (!presignResponse.ok) {
        throw new Error("Failed to get upload URLs");
      }
      const { files: signed } = (await presignResponse.json()) as {
        files: Array<{ name: string; path: string; token: string }>;
      };

      await Promise.all(
        allFiles.map((file, index) =>
          supabase.storage.from("source-files").uploadToSignedUrl(signed[index].path, signed[index].token, file, {
            contentType: file.type,
          }),
        ),
      );

      const templateOverrides = new Map<string, TemplateStorageRef>();
      localTemplateUploads.forEach((upload, index) => {
        const signedIndex = sourceFiles.length + index;
        templateOverrides.set(upload.nodeId, {
          name: upload.name,
          path: signed[signedIndex].path,
          bucket: "source-files",
        });
      });

      const pipelineSteps = buildPipelineSteps(orderedNodes, templateOverrides);

      setStep("processing");
      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputPaths: signed.slice(0, sourceFiles.length).map((file) => file.path),
          inputNames: signed.slice(0, sourceFiles.length).map((file) => file.name),
          pipelineSteps,
        }),
      });
      if (!jobResponse.ok) {
        throw new Error("Failed to create job");
      }
      const { jobId: id } = (await jobResponse.json()) as { jobId: string };
      setJobId(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
      setStep("error");
    }
  }, [canSubmit, edges, inputFiles, nodes, setError, setJobId, setStep, supabase.storage]);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center border-b bg-card shrink-0">
          <div className="w-72 shrink-0 px-4 py-2 border-r">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workflow</p>
            <p className="text-sm font-medium truncate">
              {activePipeline?.name ?? "Unsaved pipeline"}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 flex-1 flex-wrap">
            <InstructionPicker onSelect={addInstructionNode} disabled={busy} />
            <NativeSelect
              className="min-w-52"
              size="sm"
              value={activePipelineId ?? ""}
              onChange={(event) => handleLoadSavedPipeline(event.currentTarget.value)}
              disabled={busy || savedPipelines.length === 0}
            >
              <NativeSelectOption value="" disabled>
                {savedPipelines.length === 0 ? "No saved pipelines" : "Load saved pipeline"}
              </NativeSelectOption>
              {savedPipelines.map((pipeline) => (
                <NativeSelectOption key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button variant="outline" size="sm" disabled={busy} onClick={handleCreateNew}>
              <Plus className="size-3.5" />
              New
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={openSaveDialog}>
              <Save className="size-3.5" />
              Save
            </Button>
            <Link href="/automations" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Cloud className="size-3.5" />
              Automations
            </Link>
            <Button size="sm" disabled={!canSubmit} onClick={handleRun}>
              {busy ? (step === "uploading" ? "Uploading..." : "Processing...") : "Run"}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-72 shrink-0 flex flex-col">
            <WorkflowPanel
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              usage={{ balance: 12.4, estimatedCost: 0.03 }}
            />
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
              <ReactFlow<PipelineNode, PipelineEdge>
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={(changes) => {
                  onEdgesChange(changes);
                  setActivePipelineId(null);
                }}
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

            <NodeTray onAdd={addInstructionNode} disabled={busy} />
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Pipeline</DialogTitle>
            <DialogDescription>
              Stored templates are uploaded to durable storage so this pipeline can be reused by manual runs and Drive automations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="pipeline-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="pipeline-name"
              value={pipelineName}
              onChange={(event) => setPipelineName(event.target.value)}
              placeholder="Invoice extraction"
              disabled={savingPipeline}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={savingPipeline}>
              Cancel
            </Button>
            <Button onClick={handleSavePipeline} disabled={savingPipeline}>
              {savingPipeline ? "Saving..." : "Save pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
