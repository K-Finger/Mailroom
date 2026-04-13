import type {
  InstructionNodeData,
  InstructionPayload,
  InstructionType,
  PipelineEdge,
  PipelineNode,
  PipelineStep,
  StepType,
  DataShape,
  StoredTemplateAttachment,
  TemplateAttachment,
  TemplateBucket,
} from "@/store/pipeline";
import { STEP_IO, producedShape } from "@/store/pipeline";

export interface PersistedTemplateAttachment {
  id: string;
  name: string;
  path: string;
  bucket: TemplateBucket;
}

export type PersistedInstructionPayload =
  | { type: "extract"; text: string; file: PersistedTemplateAttachment | null; outputFormat: "csv" | "text" }
  | { type: "csv-parser"; file: PersistedTemplateAttachment | null }
  | { type: "extract-text" }
  | { type: "merge"; fileType: "pdf" }
  | { type: "output"; tableFormat: "xlsx" | "csv" };

export type PersistedPipelineNodeData =
  | { kind: "source"; inputFiles: [] }
  | {
      kind: "instruction";
      instructionType: InstructionType;
      payload: PersistedInstructionPayload;
      collapsed: boolean;
    };

export interface PersistedPipelineNode
  extends Omit<PipelineNode, "data"> {
  data: PersistedPipelineNodeData;
}

export interface SavedPipelineRecord {
  id: string;
  name: string;
  nodes: PersistedPipelineNode[];
  edges: PipelineEdge[];
  pipeline_steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

export interface TemplateStorageRef {
  path: string;
  bucket: TemplateBucket;
  name: string;
}

function normalizeStoredTemplate(
  attachment: PersistedTemplateAttachment,
): StoredTemplateAttachment {
  return {
    kind: "stored",
    id: attachment.id,
    name: attachment.name,
    path: attachment.path,
    bucket: attachment.bucket,
  };
}

function toStoredTemplate(
  attachment: TemplateAttachment,
): StoredTemplateAttachment | null {
  if (attachment.kind !== "stored") {
    return null;
  }

  return attachment;
}

function toPersistedTemplate(
  attachment: StoredTemplateAttachment,
): PersistedTemplateAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    path: attachment.path,
    bucket: attachment.bucket,
  };
}

export function getOrderedSteps(nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] {
  const edgeMap = new Map(edges.map((edge) => [edge.source, edge.target]));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const ordered: PipelineNode[] = [];

  let currentId: string | undefined = "source";

  while (currentId) {
    const nextId = edgeMap.get(currentId);
    if (!nextId) {
      break;
    }
    const node = nodeMap.get(nextId);
    if (!node) {
      break;
    }
    if (node.data.kind === "instruction") {
      ordered.push(node);
    }
    currentId = nextId;
  }

  return ordered;
}

export function validatePipeline(nodes: PipelineNode[]): { valid: boolean; error?: string } {
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

export function countOutputNodes(nodes: PipelineNode[]): number {
  return nodes.filter(
    (node) =>
      node.data.kind === "instruction" &&
      (node.data as InstructionNodeData).instructionType === "output",
  ).length;
}

export function collectLocalTemplateUploads(nodes: PipelineNode[]) {
  const uploads: Array<{ nodeId: string; file: File; name: string }> = [];

  for (const node of nodes) {
    if (node.data.kind !== "instruction") {
      continue;
    }
    const payload = node.data.payload as InstructionPayload;
    if (
      (payload.type === "extract" || payload.type === "csv-parser") &&
      payload.file?.kind === "local"
    ) {
      uploads.push({ nodeId: node.id, file: payload.file.file, name: payload.file.name });
    }
  }

  return uploads;
}

function resolveTemplateRef(
  attachment: TemplateAttachment | null | undefined,
  override: TemplateStorageRef | undefined,
): TemplateStorageRef | undefined {
  if (override) {
    return override;
  }
  if (!attachment) {
    return undefined;
  }
  const stored = toStoredTemplate(attachment);
  if (!stored) {
    return undefined;
  }
  return {
    name: stored.name,
    path: stored.path,
    bucket: stored.bucket,
  };
}

export function buildPipelineSteps(
  orderedNodes: PipelineNode[],
  templateOverrides = new Map<string, TemplateStorageRef>(),
): PipelineStep[] {
  return orderedNodes.map((node) => {
    const data = node.data as InstructionNodeData;
    const stepType = data.instructionType as StepType;
    const config: PipelineStep["config"] = {};

    if (stepType === "extract") {
      const payload = data.payload as Extract<InstructionPayload, { type: "extract" }>;
      const templateRef = resolveTemplateRef(payload.file, templateOverrides.get(node.id));
      if (payload.text) {
        config.prompt = payload.text;
      }
      if (templateRef) {
        config.templatePath = templateRef.path;
        config.templateBucket = templateRef.bucket;
      }
      config.outputFormat = payload.outputFormat;
    } else if (stepType === "csv-parser") {
      const payload = data.payload as Extract<InstructionPayload, { type: "csv-parser" }>;
      const templateRef = resolveTemplateRef(payload.file, templateOverrides.get(node.id));
      if (templateRef) {
        config.templatePath = templateRef.path;
        config.templateBucket = templateRef.bucket;
      }
    } else if (stepType === "merge") {
      const payload = data.payload as Extract<InstructionPayload, { type: "merge" }>;
      config.fileType = payload.fileType;
    } else if (stepType === "output") {
      const payload = data.payload as Extract<InstructionPayload, { type: "output" }>;
      config.nodeId = node.id;
      config.tableFormat = payload.tableFormat;
    }

    return { type: stepType, config };
  });
}

function toPersistedPayload(
  payload: InstructionPayload,
  override: PersistedTemplateAttachment | undefined,
): PersistedInstructionPayload {
  if (payload.type === "extract") {
    const file = override ?? (payload.file?.kind === "stored" ? toPersistedTemplate(payload.file) : null);
    return {
      type: "extract",
      text: payload.text,
      file,
      outputFormat: payload.outputFormat,
    };
  }

  if (payload.type === "csv-parser") {
    const file = override ?? (payload.file?.kind === "stored" ? toPersistedTemplate(payload.file) : null);
    return { type: "csv-parser", file };
  }

  if (payload.type === "extract-text") {
    return { type: "extract-text" };
  }

  if (payload.type === "merge") {
    return { type: "merge", fileType: payload.fileType };
  }

  return { type: "output", tableFormat: payload.tableFormat };
}

export function sanitizeNodesForPersistence(
  nodes: PipelineNode[],
  templateOverrides = new Map<string, PersistedTemplateAttachment>(),
): PersistedPipelineNode[] {
  return nodes.map((node) => {
    if (node.data.kind === "source") {
      return {
        ...node,
        data: { kind: "source", inputFiles: [] },
      };
    }

    const data = node.data as InstructionNodeData;
    return {
      ...node,
      data: {
        kind: "instruction",
        instructionType: data.instructionType,
        payload: toPersistedPayload(data.payload, templateOverrides.get(node.id)),
        collapsed: data.collapsed,
      },
    };
  });
}

export function hydratePersistedNodes(nodes: PersistedPipelineNode[]): PipelineNode[] {
  return nodes.map((node) => {
    if (node.data.kind === "source") {
      return {
        ...node,
        data: { kind: "source", inputFiles: [] },
      };
    }

    const data = node.data;
    if (data.payload.type === "extract") {
      return {
        ...node,
        data: {
          kind: "instruction",
          instructionType: data.instructionType,
          collapsed: data.collapsed,
          payload: {
            type: "extract",
            text: data.payload.text,
            outputFormat: data.payload.outputFormat,
            file: data.payload.file ? normalizeStoredTemplate(data.payload.file) : null,
          },
        },
      };
    }

    if (data.payload.type === "csv-parser") {
      return {
        ...node,
        data: {
          kind: "instruction",
          instructionType: data.instructionType,
          collapsed: data.collapsed,
          payload: {
            type: "csv-parser",
            file: data.payload.file ? normalizeStoredTemplate(data.payload.file) : null,
          },
        },
      };
    }

    return {
      ...node,
      data: {
        kind: "instruction",
        instructionType: data.instructionType,
        collapsed: data.collapsed,
        payload: data.payload,
      },
    };
  });
}
