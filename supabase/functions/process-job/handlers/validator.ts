import type { StepHandler } from "../types.ts";

interface ValidationRule {
  id: string;
  field: string;
  check:
    | "required"
    | "numeric"
    | "positive"
    | "range"
    | "date"
    | "regex"
    | "no-duplicates"
    | "sum-equals";
  min?: number;
  max?: number;
  pattern?: string;
  sumFields?: string[];
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function isDate(v: unknown): boolean {
  if (v == null || v === "") return false;
  const d = new Date(String(v));
  return !isNaN(d.getTime());
}

function validateRow(
  row: Record<string, unknown>,
  rules: ValidationRule[],
  allRows: Record<string, unknown>[],
  rowIndex: number,
): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    const val = row[rule.field];
    const label = rule.field;

    switch (rule.check) {
      case "required":
        if (val == null || val === "") errors.push(`${label}: required`);
        break;

      case "numeric": {
        if (val != null && val !== "" && toNum(val) === null)
          errors.push(`${label}: must be numeric`);
        break;
      }

      case "positive": {
        const n = toNum(val);
        if (n !== null && n <= 0) errors.push(`${label}: must be positive`);
        break;
      }

      case "range": {
        const n = toNum(val);
        if (n !== null) {
          if (rule.min != null && n < rule.min)
            errors.push(`${label}: must be ≥ ${rule.min}`);
          if (rule.max != null && n > rule.max)
            errors.push(`${label}: must be ≤ ${rule.max}`);
        }
        break;
      }

      case "date":
        if (val != null && val !== "" && !isDate(val))
          errors.push(`${label}: must be a valid date`);
        break;

      case "regex": {
        if (rule.pattern && val != null && val !== "") {
          try {
            if (!new RegExp(rule.pattern).test(String(val)))
              errors.push(`${label}: does not match pattern`);
          } catch {
            // invalid regex — skip
          }
        }
        break;
      }

      case "no-duplicates": {
        if (val != null && val !== "") {
          const firstIndex = allRows.findIndex((r) => r[rule.field] === val);
          if (firstIndex !== rowIndex)
            errors.push(`${label}: duplicate value "${val}"`);
        }
        break;
      }

      case "sum-equals": {
        if (rule.sumFields?.length) {
          const fieldTotal = toNum(val);
          const sum = rule.sumFields.reduce((acc, f) => acc + (toNum(row[f]) ?? 0), 0);
          // Allow 0.01 tolerance for floating point
          if (fieldTotal !== null && Math.abs(sum - fieldTotal) > 0.01)
            errors.push(`${label}: expected ${fieldTotal}, sum of [${rule.sumFields.join(", ")}] = ${sum.toFixed(2)}`);
        }
        break;
      }
    }
  }

  return errors;
}

export const validator: StepHandler = {
  accepts: ["table"],
  produces: "table",
  async run(input, config) {
    if (input.shape !== "table") throw new Error("validator requires table input");
    const rules: ValidationRule[] = (config.rules as ValidationRule[]) ?? [];

    const rows = input.rows.map((row, i) => {
      const errors = validateRow(row, rules, input.rows, i);
      return {
        ...row,
        _valid: errors.length === 0,
        _errors: errors.join("; "),
      };
    });

    const columns = [
      ...input.columns.filter((c) => c !== "_valid" && c !== "_errors"),
      "_valid",
      "_errors",
    ];

    return { shape: "table", columns, rows };
  },
};
