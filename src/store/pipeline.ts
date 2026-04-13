import { create } from "zustand";
import { addEdge, type Node, type Edge, type Connection } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Pipeline step types (shared with Edge Function)
// ---------------------------------------------------------------------------

export type DataShape = "files" | "texts" | "table";
export type StepType = "extract-text" | "extract" | "csv-parser" | "merge" | "output" | "validator" | "google-sheets" | "filter" | "email";

export type ValidationCheck =
  | "required"
  | "numeric"
  | "positive"
  | "range"
  | "date"
  | "regex"
  | "no-duplicates"
  | "sum-equals";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface ValidationRule {
  id: string;
  field: string;
  check: ValidationCheck;
  min?: number;
  max?: number;
  pattern?: string;
  sumFields?: string[];
}

export interface PipelineStep {
  type: StepType;
  config: {
    prompt?: string;
    templatePath?: string;
    fileType?: string;
    outputFormat?: "csv" | "text";
    /** Output + google-sheets steps — identifies which node produced this result in result_paths[]. */
    nodeId?: string;
    /** Output steps only — format for table data. */
    tableFormat?: "xlsx" | "csv";
    /** Google Sheets steps only */
    sheetId?: string;
    sheetTab?: string;
    /** Validator steps only */
    rules?: ValidationRule[];
    /** Filter steps only */
    filterRules?: FilterRule[];
    /** Email steps only */
    emailTo?: string;
    emailSubject?: string;
    emailBody?: string;
    emailFormat?: "xlsx" | "csv";
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
  validator: { accepts: ["table"], produces: "table" },
  filter: { accepts: ["table"], produces: "table" },
  "google-sheets": { accepts: ["table"], produces: "table" }, // appends then passes through
  output: { accepts: ["files", "texts", "table"], produces: "files" }, // produces=placeholder
  email: { accepts: ["files", "texts", "table"], produces: "files" }, // produces=placeholder (pass-through)
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

export type InstructionType = StepType;

export interface TemplateData {
  columns: string[];
  rows: Record<string, string>[];
}

export type InstructionPayload =
  | { type: "extract"; text: string; file: PipelineFile | null; outputFormat: "csv" | "text"; templateData: TemplateData | null }
  | { type: "csv-parser"; file: PipelineFile | null }
  | { type: "extract-text" }
  | { type: "merge"; fileType: "pdf" }
  | { type: "output"; tableFormat: "xlsx" | "csv" }
  | { type: "validator"; rules: ValidationRule[] }
  | { type: "google-sheets"; sheetId: string | null; sheetTab: string; sheetName: string }
  | { type: "filter"; rules: FilterRule[] }
  | { type: "email"; to: string; subject: string; body: string; format: "xlsx" | "csv" };

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
  if (type === "extract") return { type: "extract", text: "", file: null, outputFormat: "csv", templateData: null };
  if (type === "csv-parser") return { type: "csv-parser", file: null };
  if (type === "extract-text") return { type: "extract-text" };
  if (type === "merge") return { type: "merge", fileType: "pdf" };
  if (type === "validator") return { type: "validator", rules: [] };
  if (type === "google-sheets") return { type: "google-sheets", sheetId: null, sheetTab: "Sheet1", sheetName: "" };
  if (type === "filter") return { type: "filter", rules: [] };
  if (type === "email") return { type: "email", to: "", subject: "Pipeline results", body: "", format: "xlsx" };
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
  if (type === "output" || type === "email") return currentShape;
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

export interface PreviewData {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}

interface PipelineState {
  step: ProcessingStep;
  jobId: string | null;
  results: Record<string, string>; // nodeId → signed URL or sheet URL
  error: string | null;
  previewData: PreviewData | null;
  templateEditorNodeId: string | null;
  setStep: (step: ProcessingStep) => void;
  setJobId: (id: string | null) => void;
  setResults: (results: Record<string, string>) => void;
  setError: (error: string | null) => void;
  setPreviewData: (data: PreviewData | null) => void;
  setTemplateEditorNodeId: (id: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  step: "idle",
  jobId: null,
  results: {},
  error: null,
  previewData: null,
  templateEditorNodeId: null,
  setStep: (step) => set({ step }),
  setJobId: (id) => set({ jobId: id }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  setPreviewData: (data) => set({ previewData: data }),
  setTemplateEditorNodeId: (id) => set({ templateEditorNodeId: id }),
  reset: () => set({ step: "idle", jobId: null, results: {}, error: null, previewData: null }),
}));
