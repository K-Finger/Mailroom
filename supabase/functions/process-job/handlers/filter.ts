import type { StepHandler } from "../types.ts";

type FilterOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "greater_than" | "less_than"
  | "is_empty" | "is_not_empty";

interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

function matchesRule(row: Record<string, unknown>, rule: FilterRule): boolean {
  const raw = row[rule.field];
  const cell = raw == null ? "" : String(raw);
  const val = rule.value ?? "";

  switch (rule.operator) {
    case "equals":       return cell === val;
    case "not_equals":   return cell !== val;
    case "contains":     return cell.toLowerCase().includes(val.toLowerCase());
    case "not_contains": return !cell.toLowerCase().includes(val.toLowerCase());
    case "greater_than": return Number(cell) > Number(val);
    case "less_than":    return Number(cell) < Number(val);
    case "is_empty":     return cell === "";
    case "is_not_empty": return cell !== "";
  }
}

export const filter: StepHandler = {
  accepts: ["table"],
  produces: "table",
  async run(input, config) {
    if (input.shape !== "table") throw new Error("filter requires table input");
    const rules: FilterRule[] = (config.filterRules as FilterRule[]) ?? [];

    if (rules.length === 0) return input;

    const rows = input.rows.filter((row) => rules.every((rule) => matchesRule(row, rule)));
    return { shape: "table", columns: input.columns, rows };
  },
};
