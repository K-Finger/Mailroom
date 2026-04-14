"use client";

import { useCallback } from "react";
import { X, ChevronDown, ChevronUp, Sparkles, Table2, FileText, Download, Layers, ShieldCheck, Sheet, Filter, Mail } from "lucide-react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  usePipelineStore,
  type InstructionNodeData,
  type PipelineNode,
  type InstructionType,
} from "@/store/pipeline";
import { ExtractForm } from "./ExtractForm";
import { CsvParserForm } from "./CsvParserForm";
import { MergeForm } from "./MergeForm";
import { OutputStatus } from "./OutputStatus";
import { ValidatorForm } from "./ValidatorForm";
import { GoogleSheetsForm } from "./GoogleSheetsForm";
import { FilterForm } from "./FilterForm";
import { EmailForm } from "./EmailForm";

const TYPE_META: Record<InstructionType, {
  icon: React.ElementType;
  label: string;
  collapsible: boolean;
  hasContent: boolean;
}> = {
  extract:          { icon: Sparkles,    label: "AI Extract",      collapsible: true,  hasContent: true  },
  "csv-parser":     { icon: Table2,      label: "CSV Parser",      collapsible: true,  hasContent: true  },
  "extract-text":   { icon: FileText,    label: "Text Extract",    collapsible: false, hasContent: false },
  merge:            { icon: Layers,      label: "Merge",           collapsible: true,  hasContent: true  },
  output:           { icon: Download,    label: "Output",          collapsible: false, hasContent: true  },
  validator:        { icon: ShieldCheck, label: "Validator",       collapsible: true,  hasContent: true  },
  "google-sheets":  { icon: Sheet,       label: "Google Sheets",   collapsible: true,  hasContent: true  },
  filter:           { icon: Filter,      label: "Filter",          collapsible: true,  hasContent: true  },
  email:            { icon: Mail,        label: "Email",           collapsible: true,  hasContent: true  },
};

/** Dynamic width for extract nodes — grows with prompt text length. */
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
    ? extractWidth((d.payload as Extract<typeof d.payload, { type: "extract" }>).text)
    : (d.instructionType === "validator" || d.instructionType === "filter")
    ? 320
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
        className="shrink-0 rounded-xl border border-blue-400/50 bg-card shadow-sm transition-[width] duration-150"
        style={{ width }}
      >
        <Handle type="target" position={Position.Left} className="bg-foreground/40! border-0! w-4! h-4!" />

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
              {d.instructionType === "extract"        && <ExtractForm id={id} data={d} />}
              {d.instructionType === "csv-parser"     && <CsvParserForm id={id} data={d} />}
              {d.instructionType === "merge"          && <MergeForm id={id} data={d} />}
              {d.instructionType === "validator"      && <ValidatorForm id={id} data={d} />}
              {d.instructionType === "google-sheets"  && <GoogleSheetsForm id={id} data={d} />}
              {d.instructionType === "filter"         && <FilterForm id={id} data={d} />}
              {d.instructionType === "email"          && <EmailForm id={id} data={d} />}
            </div>
          </CollapsibleContent>
        )}

        {!collapsible && hasContent && d.instructionType === "output" && (
          <div className="border-t border-border px-4 py-4 nodrag nopan">
            <OutputStatus id={id} />
          </div>
        )}

        <Handle type="source" position={Position.Right} className="bg-foreground/40! border-0! w-4! h-4!" />
      </div>
    </Collapsible>
  );
}
