import { create } from "zustand";
import { addEdge, type Node, type Edge, type Connection } from "@xyflow/react";

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

export type InstructionType = "extract" | "csv-parser" | "transcribe" | "output";

export type InstructionPayload =
  | { type: "extract"; text: string; file: PipelineFile | null; nativePdf: boolean }
  | { type: "csv-parser"; file: PipelineFile | null }
  | { type: "transcribe" }
  | { type: "output" };

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
  if (type === "extract") return { type: "extract", text: "", file: null, nativePdf: false };
  if (type === "csv-parser") return { type: "csv-parser", file: null };
  if (type === "transcribe") return { type: "transcribe" };
  return { type: "output" };
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
    data: { kind: "instruction", instructionType: "output", payload: { type: "output" }, collapsed: false },
    deletable: false,
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
  resultUrl: string | null;
  error: string | null;
  setStep: (step: ProcessingStep) => void;
  setJobId: (id: string | null) => void;
  setResultUrl: (url: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  step: "idle",
  jobId: null,
  resultUrl: null,
  error: null,
  setStep: (step) => set({ step }),
  setJobId: (id) => set({ jobId: id }),
  setResultUrl: (url) => set({ resultUrl: url }),
  setError: (error) => set({ error }),
  reset: () => set({ step: "idle", jobId: null, resultUrl: null, error: null }),
}));
