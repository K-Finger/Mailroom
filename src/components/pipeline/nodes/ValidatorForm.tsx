"use client";

import { useReactFlow } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import type { InstructionNodeData, InstructionPayload, ValidationRule, ValidationCheck } from "@/store/pipeline";

const CHECKS: { value: ValidationCheck; label: string; hasValue: "none" | "range" | "text" | "fields" }[] = [
  { value: "required",      label: "Required",       hasValue: "none"   },
  { value: "numeric",       label: "Is numeric",     hasValue: "none"   },
  { value: "positive",      label: "Is positive",    hasValue: "none"   },
  { value: "date",          label: "Is date",        hasValue: "none"   },
  { value: "no-duplicates", label: "No duplicates",  hasValue: "none"   },
  { value: "range",         label: "In range",       hasValue: "range"  },
  { value: "regex",         label: "Matches",        hasValue: "text"   },
  { value: "sum-equals",    label: "Sum equals",     hasValue: "fields" },
];

const cellCls = "border-r border-border last:border-r-0 px-1.5";
const inputCls = "w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60";
const selectCls = "w-full bg-transparent text-xs outline-none cursor-pointer";

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
    update(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full border border-border rounded-md overflow-hidden text-xs">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium w-22.5`}>Field</th>
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium w-25`}>Rule</th>
            <th className={`${cellCls} py-1 text-left text-[10px] text-muted-foreground font-medium`}>Value</th>
            <th className="w-6 py-1" />
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-2 text-[10px] text-muted-foreground text-center">
                No rules yet
              </td>
            </tr>
          )}
          {rules.map((rule, i) => {
            const checkMeta = CHECKS.find((c) => c.value === rule.check);
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
                    value={rule.check}
                    onChange={(e) => patchRule(rule.id, { check: e.target.value as ValidationCheck })}
                  >
                    {CHECKS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </td>
                <td className={`${cellCls} py-1`}>
                  {checkMeta?.hasValue === "range" && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className={`${inputCls} w-10`}
                        placeholder="min"
                        value={rule.min ?? ""}
                        onChange={(e) => patchRule(rule.id, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="number"
                        className={`${inputCls} w-10`}
                        placeholder="max"
                        value={rule.max ?? ""}
                        onChange={(e) => patchRule(rule.id, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {checkMeta?.hasValue === "text" && (
                    <input
                      className={`${inputCls} font-mono`}
                      placeholder="pattern"
                      value={rule.pattern ?? ""}
                      onChange={(e) => patchRule(rule.id, { pattern: e.target.value })}
                    />
                  )}
                  {checkMeta?.hasValue === "fields" && (
                    <input
                      className={inputCls}
                      placeholder="col1, col2"
                      value={rule.sumFields?.join(", ") ?? ""}
                      onChange={(e) =>
                        patchRule(rule.id, {
                          sumFields: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
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
        Add rule
      </button>
    </div>
  );
}
