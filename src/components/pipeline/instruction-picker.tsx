"use client";

import { useState } from "react";
import { Sparkles, Table2, FileText, Download, Plus, Layers, ShieldCheck, Sheet, Filter, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InstructionType } from "@/store/pipeline";

export const INSTRUCTION_TYPES: { id: InstructionType; icon: React.ElementType; label: string; description: string }[] = [
  {
    id: "extract",
    icon: Sparkles,
    label: "AI Extract",
    description: "Prompt + optional template to define output structure",
  },
  {
    id: "csv-parser",
    icon: Table2,
    label: "CSV Parser",
    description: "Upload a CSV with {{placeholders}} for fields to extract",
  },
  {
    id: "merge",
    icon: Layers,
    label: "Merge",
    description: "Combine files of one type into one before processing",
  },
  {
    id: "extract-text",
    icon: FileText,
    label: "Text Extract",
    description: "Use AI to pull text from files, outputting plain text",
  },
  {
    id: "output",
    icon: Download,
    label: "Output",
    description: "Download pipeline data at this point",
  },
  {
    id: "validator",
    icon: ShieldCheck,
    label: "Validator",
    description: "Check table rows against rules — required fields, numeric ranges, totals",
  },
  {
    id: "google-sheets",
    icon: Sheet,
    label: "Google Sheets",
    description: "Append table rows to an existing Google Sheet",
  },
  {
    id: "filter",
    icon: Filter,
    label: "Filter",
    description: "Keep only rows that match all conditions",
  },
  {
    id: "email",
    icon: Mail,
    label: "Email",
    description: "Send results as an email attachment",
  },
];

interface InstructionPickerProps {
  onSelect: (type: InstructionType) => void;
  disabled?: boolean;
}

export function InstructionPicker({ onSelect, disabled }: InstructionPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground/30 bg-background text-foreground/30 transition-colors hover:border-foreground/60 hover:text-foreground/60 disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Plus className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="center">
        {INSTRUCTION_TYPES.map(({ id, icon: Icon, label, description }) => (
          <button
            key={id}
            onClick={() => { onSelect(id); setOpen(false); }}
            className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
