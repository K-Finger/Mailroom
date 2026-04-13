import { create } from "zustand";
import { addEdge, type Node, type Edge, type Connection } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Pipeline step types (shared with Edge Function)
// ---------------------------------------------------------------------------

export type DataShape = "files" | "texts" | "table";
export type StepType = "extract-text" | "extract" | "csv-parser" | "merge" | "output";

export interface PipelineStep {
  type: StepType;
  config: {
    prompt?: string;
    templatePath?: string;
    fileType?: string;
    outputFormat?: "csv" | "text";
    /** Output steps only — identifies which node produced this result in result_paths[]. */
    nodeId?: string;
    /** Output steps only — format for table data. */
    tableFormat?: "xlsx" | "csv";
  };
}

/**
 * Static accept/produce contracts per step type.
 * output.produces is a placeholder — use producedShape() which returns the
 * incoming shape unchanged for output nodes (pass-through).
 */
export const STEP_IO: Record<StepType, { accepts: DataShape[]; produces: DataShape }> = {
  merge: { accepts: ["files"], produces: "files" },
  "extract-text": { accepts: ["files"], produces: "texts" },
  extract: { accepts: ["files", "texts"], produces: "table" },
  "csv-parser": { accepts: ["files", "texts"], produces: "table" },
  output: { accepts: ["files", "texts", "table"], produces: "files" }, // produces=placeholder
};

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

export type ProcessingStep = "idle" | "uploading" | "processing" | "done" | "error";

export interface PipelineFile {
  id: string;
  file: File;
  name: string;
  thumbnail?: string; // base64 data URL for PDF first-page preview
}

export type InstructionType = "extract" | "csv-parser" | "extract-text" | "merge" | "output";

export type InstructionPayload =
  | { type: "extract"; text: string; file: PipelineFile | null; outputFormat: "csv" | "text" }
  | { type: "csv-parser"; file: PipelineFile | null }
  | { type: "extract-text" }
  | { type: "merge"; fileType: "pdf" }
  | { type: "output"; tableFormat: "xlsx" | "csv" };

export interface SourceNodeData extends Record<string, unknown> {
  kind: "source";
  inputFiles: PipelineFile[];
}

export interface InstructionNodeData extends Record<string, unknown> {
  kind: "instruction";
  instructionType: InstructionType;
  payload: InstructionPayload;
  collapsed: boolean;
}

export type PipelineNodeData = SourceNodeData | InstructionNodeData;

export type PipelineNode = Node<PipelineNodeData>;
export type PipelineEdge = Edge;

// ---------------------------------------------------------------------------
// Layout constants & helpers (used by Pipeline.tsx)
// ---------------------------------------------------------------------------

export const NODE_WIDTH = 200;
export const NODE_GAP = 80;

export function defaultPayload(type: InstructionType): InstructionPayload {
  if (type === "extract") return { type: "extract", text: "", file: null, outputFormat: "csv" };
  if (type === "csv-parser") return { type: "csv-parser", file: null };
  if (type === "extract-text") return { type: "extract-text" };
  if (type === "merge") return { type: "merge", fileType: "pdf" };
  return { type: "output", tableFormat: "xlsx" };
}

/**
 * Returns the actual output shape of a node.
 * `currentShape` is required for output nodes (they pass the shape through unchanged).
 */
export function producedShape(
  type: StepType,
  payload?: InstructionPayload,
  currentShape: DataShape = "files",
): DataShape {
  if (type === "output") return currentShape;
  if (type === "extract") {
    const p = payload as Extract<InstructionPayload, { type: "extract" }> | undefined;
    if (p?.outputFormat === "text") return "texts";
  }
  return STEP_IO[type].produces;
}

export function buildEdge(source: string, target: string): PipelineEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    style: { stroke: "color-mix(in oklch, var(--foreground) 30%, transparent)", strokeWidth: 2 },
  };
}

export const INITIAL_NODES: PipelineNode[] = [
  {
    id: "source",
    type: "sourceNode",
    position: { x: 0, y: 0 },
    data: { kind: "source", inputFiles: [] },
    deletable: false,
    draggable: true,
  },
  {
    id: "output-default",
    type: "instructionNode",
    position: { x: NODE_WIDTH + NODE_GAP, y: 0 },
    data: { kind: "instruction", instructionType: "output", payload: { type: "output", tableFormat: "xlsx" }, collapsed: false },
    draggable: true,
  },
];

export const INITIAL_EDGES: PipelineEdge[] = [buildEdge("source", "output-default")];

// Re-export addEdge so Pipeline.tsx only needs one import source
export { addEdge, type Connection };

// ---------------------------------------------------------------------------
// Store — job state only
// ---------------------------------------------------------------------------

interface PipelineState {
  step: ProcessingStep;
  jobId: string | null;
  results: Record<string, string>; // nodeId → signed URL
  error: string | null;
  setStep: (step: ProcessingStep) => void;
  setJobId: (id: string | null) => void;
  setResults: (results: Record<string, string>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  step: "idle",
  jobId: null,
  results: {},
  error: null,
  setStep: (step) => set({ step }),
  setJobId: (id) => set({ jobId: id }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  reset: () => set({ step: "idle", jobId: null, results: {}, error: null }),
}));
