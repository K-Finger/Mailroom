"use client";

import { useReactFlow } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import type { InstructionNodeData, InstructionPayload, FilterRule, FilterOperator } from "@/store/pipeline";

const OPERATORS: { value: FilterOperator; label: string; hasValue: boolean }[] = [
  { value: "equals",       label: "=",           hasValue: true  },
  { value: "not_equals",   label: "≠",           hasValue: true  },
  { value: "contains",     label: "contains",    hasValue: true  },
  { value: "not_contains", label: "excludes",    hasValue: true  },
  { value: "greater_than", label: ">",           hasValue: true  },
  { value: "less_than",    label: "<",           hasValue: true  },
  { value: "is_empty",     label: "is empty",    hasValue: false },
  { value: "is_not_empty", label: "not empty",   hasValue: false },
];

const cellCls = "border-r border-border last:border-r-0 px-1.5";
const inputCls = "w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60";
const selectCls = "w-full bg-transparent text-xs outline-none cursor-pointer";

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
    update(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-muted-foreground">Keep rows where ALL rules match</p>
      <table className="w-full border border-border rounded-md overflow-hidden text-xs">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium w-25`}>Field</th>
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium w-22.5`}>Op</th>
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium`}>Value</th>
            <th className="w-6 py-1" />
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-2 text-[10px] text-muted-foreground text-center">
                No filters yet
              </td>
            </tr>
          )}
          {rules.map((rule, i) => {
            const opMeta = OPERATORS.find((o) => o.value === rule.operator);
            return (
              <tr key={rule.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className={`${cellCls} py-1`}>
                  <input
                    className={inputCls}
                    placeholder="column"
                    value={rule.field}
                    onChange={(e) => patchRule(rule.id, { field: e.target.value })}
                  />
                </td>
                <td className={`${cellCls} py-1`}>
                  <select
                    className={selectCls}
                    value={rule.operator}
                    onChange={(e) => patchRule(rule.id, { operator: e.target.value as FilterOperator })}
                  >
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className={`${cellCls} py-1`}>
                  {opMeta?.hasValue && (
                    <input
                      className={inputCls}
                      placeholder="value"
                      value={rule.value}
                      onChange={(e) => patchRule(rule.id, { value: e.target.value })}
                    />
                  )}
                </td>
                <td className="py-1 px-1 text-center">
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="rounded p-0.5 hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        onClick={addRule}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3" />
        Add filter
      </button>
    </div>
  );
}
