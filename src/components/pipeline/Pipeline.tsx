"use client";

import { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import { createClient } from "@/lib/supabase/client";
import {
  usePipelineStore,
  INITIAL_NODES,
  INITIAL_EDGES,
  NODE_WIDTH,
  NODE_GAP,
  buildEdge,
  defaultPayload,
  type SourceNodeData,
  type InstructionNodeData,
  type InstructionPayload,
  type InstructionType,
  type PipelineNode,
} from "@/store/pipeline";
import { Button } from "@/components/ui/button";
import { InstructionPicker } from "./instruction-picker";
import { SourceNode } from "./nodes/SourceNode";
import { InstructionNode } from "./nodes/InstructionNode";

const nodeTypes: NodeTypes = {
  sourceNode: SourceNode,
  instructionNode: InstructionNode,
};

export function Pipeline() {
  const supabase = createClient();
  const { step, jobId, setStep, setJobId, setResultUrl, setError } = usePipelineStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
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

  const busy = step === "uploading" || step === "processing";
  const sourceNode = nodes.find((n) => n.id === "source");
  const inputFiles = (sourceNode?.data as SourceNodeData)?.inputFiles ?? [];
  const canSubmit = inputFiles.length > 0 && !busy && step !== "done";

  // Poll job status
  useEffect(() => {
    if (!jobId || step === "done" || step === "error" || step === "idle") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const job = await res.json() as { status: string; result_url?: string; error_message?: string };
      if (job.status === "done") {
        clearInterval(interval);
        setResultUrl(job.result_url ?? null);
        setStep("done");
      } else if (job.status === "error") {
        clearInterval(interval);
        setError(job.error_message ?? "Processing failed");
        setStep("error");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, step]);

  const handleRun = useCallback(async () => {
    if (!canSubmit) return;
    setStep("uploading");
    setError(null);

    try {
      const sourceFiles = inputFiles.map((f) => f.file);
      const instructionNodes = nodes.filter((n) => n.data.kind === "instruction");

      // Extract node: text prompt + optional template
      const extractPayload = instructionNodes
        .filter((n) => (n.data as InstructionNodeData).instructionType === "extract")
        .map((n) => (n.data as InstructionNodeData).payload as Extract<InstructionPayload, { type: "extract" }>);

      // CSV parser node: template file only
      const csvParserPayload = instructionNodes
        .find((n) => (n.data as InstructionNodeData).instructionType === "csv-parser");
      const csvParserFile = csvParserPayload
        ? ((csvParserPayload.data as InstructionNodeData).payload as Extract<InstructionPayload, { type: "csv-parser" }>).file?.file ?? null
        : null;

      // Template file: prefer csv-parser, fall back to extract template
      const templateFile = csvParserFile
        ?? extractPayload.find((p) => p.file)?.file?.file
        ?? null;

      const textInstructions = extractPayload.map((p) => p.text).filter(Boolean).join("\n");
      const nativePdf = extractPayload.some((p) => p.nativePdf);

      const allFiles = templateFile ? [...sourceFiles, templateFile] : sourceFiles;

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

      const sourceSigned = signed.slice(0, sourceFiles.length);
      const templateSigned = templateFile ? signed[sourceFiles.length] : null;

      setStep("processing");
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputPaths: sourceSigned.map((f) => f.path),
          inputNames: sourceSigned.map((f) => f.name),
          instructionText: textInstructions || undefined,
          instructionPath: templateSigned?.path,
          nativePdf,
        }),
      });
      if (!jobRes.ok) throw new Error("Failed to create job");
      const { jobId: id } = await jobRes.json() as { jobId: string };
      setJobId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }, [canSubmit, nodes, inputFiles]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <InstructionPicker onSelect={addInstructionNode} disabled={busy} />
        <Button size="sm" disabled={!canSubmit} onClick={handleRun}>
          {busy ? (step === "uploading" ? "Uploading..." : "Processing...") : "Run"}
        </Button>
      </div>

      <div className="w-full h-150 rounded-xl border border-border overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.5}
          translateExtent={[[-400, -300], [2000, 800]]}
          edgesReconnectable={false}
          defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "color-mix(in oklch, var(--foreground) 30%, transparent)", strokeWidth: 2 } }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-30" />
          <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground" />
          <MiniMap className="bg-card! border-border!" />
        </ReactFlow>
      </div>
    </div>
  );
}
