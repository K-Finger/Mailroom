"use client";

import { useReactFlow } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InstructionNodeData, InstructionPayload, FilterRule, FilterOperator } from "@/store/pipeline";

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const VALUE_OPERATORS: FilterOperator[] = [
  "equals", "not_equals", "contains", "not_contains", "greater_than", "less_than",
];

export function FilterForm({ id, data }: { id: string; data: InstructionNodeData }) {
  const { updateNodeData } = useReactFlow();
  const payload = data.payload as Extract<InstructionPayload, { type: "filter" }>;
  const rules = payload.rules;

  const update = (next: FilterRule[]) =>
    updateNodeData(id, { payload: { ...payload, rules: next } });

  const addRule = () =>
    update([...rules, { id: crypto.randomUUID(), field: "", operator: "equals", value: "" }]);

  const removeRule = (ruleId: string) =>
    update(rules.filter((r) => r.id !== ruleId));

  const patchRule = (ruleId: string, patch: Partial<FilterRule>) =>
    update(rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r));

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">No filters yet. Rows are kept when ALL rules match.</p>
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
            value={rule.operator}
            onValueChange={(v) => patchRule(rule.id, { operator: v as FilterOperator })}
          >
            <SelectTrigger size="sm" className="h-6 text-xs">
              <SelectValue>{(v: string) => OPERATOR_LABELS[v as FilterOperator] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OPERATOR_LABELS) as FilterOperator[]).map((op) => (
                <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {VALUE_OPERATORS.includes(rule.operator) && (
            <Input
              placeholder="Value"
              value={rule.value}
              onChange={(e) => patchRule(rule.id, { value: e.target.value })}
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
        Add filter
      </Button>
    </div>
  );
}
