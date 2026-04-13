"use client";

import { useReactFlow } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InstructionNodeData, InstructionPayload, ValidationRule, ValidationCheck } from "@/store/pipeline";

const CHECK_LABELS: Record<ValidationCheck, string> = {
  required: "Required",
  numeric: "Is numeric",
  positive: "Is positive",
  range: "In range",
  date: "Is date",
  regex: "Matches pattern",
  "no-duplicates": "No duplicates",
  "sum-equals": "Sum equals",
};

export function ValidatorForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const payload = data.payload as Extract<InstructionPayload, { type: "validator" }>;
  const rules = payload.rules;

  const update = (next: ValidationRule[]) =>
    updateNodeData(id, { payload: { ...payload, rules: next } });

  const addRule = () =>
    update([...rules, { id: crypto.randomUUID(), field: "", check: "required" }]);

  const removeRule = (ruleId: string) =>
    update(rules.filter((r) => r.id !== ruleId));

  const patchRule = (ruleId: string, patch: Partial<ValidationRule>) =>
    update(rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r));

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">No rules yet. Add one below.</p>
      )}

      {rules.map((rule) => (
        <div key={rule.id} className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2">
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Field name"
              value={rule.field}
              onChange={(e) => patchRule(rule.id, { field: e.target.value })}
              className="h-6 text-xs flex-1 min-w-0"
            />
            <button
              onClick={() => removeRule(rule.id)}
              className="shrink-0 rounded p-0.5 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>

          <Select
            value={rule.check}
            onValueChange={(v) => patchRule(rule.id, { check: v as ValidationCheck })}
          >
            <SelectTrigger size="sm" className="h-6 text-xs">
              <SelectValue>{(v: string) => CHECK_LABELS[v as ValidationCheck] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CHECK_LABELS) as ValidationCheck[]).map((c) => (
                <SelectItem key={c} value={c}>{CHECK_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {rule.check === "range" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Min"
                value={rule.min ?? ""}
                onChange={(e) => patchRule(rule.id, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="h-6 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder="Max"
                value={rule.max ?? ""}
                onChange={(e) => patchRule(rule.id, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="h-6 text-xs"
              />
            </div>
          )}

          {rule.check === "regex" && (
            <Input
              placeholder="Pattern (e.g. ^\d{4}-\d{2}-\d{2}$)"
              value={rule.pattern ?? ""}
              onChange={(e) => patchRule(rule.id, { pattern: e.target.value })}
              className="h-6 text-xs font-mono"
            />
          )}

          {rule.check === "sum-equals" && (
            <Input
              placeholder="Fields to sum (comma-separated)"
              value={rule.sumFields?.join(", ") ?? ""}
              onChange={(e) =>
                patchRule(rule.id, {
                  sumFields: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              className="h-6 text-xs"
            />
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5 w-full mt-1"
        onClick={addRule}
      >
        <Plus className="size-3" />
        Add rule
      </Button>
    </div>
  );
}
