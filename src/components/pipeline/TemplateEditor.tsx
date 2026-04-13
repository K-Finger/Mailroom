"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateData } from "@/store/pipeline";

interface Props {
  initialData: TemplateData | null;
  onSave: (data: TemplateData) => void;
  onClose: () => void;
}

const EMPTY: TemplateData = { columns: ["Field 1", "Field 2"], rows: [] };

export function TemplateEditor({ initialData, onSave, onClose }: Props) {
  const [columns, setColumns] = useState<string[]>(initialData?.columns ?? EMPTY.columns);
  const [rows, setRows] = useState<Record<string, string>[]>(initialData?.rows ?? EMPTY.rows);
  const newColRef = useRef<HTMLInputElement | null>(null);

  // Focus the last column header when columns are added
  useEffect(() => {
    newColRef.current?.focus();
    newColRef.current?.select();
  }, [columns.length]);

  // ── Column ops ────────────────────────────────────────────────
  const addColumn = () => {
    const name = `Field ${columns.length + 1}`;
    setColumns((c) => [...c, name]);
  };

  const renameColumn = (i: number, name: string) => {
    const oldName = columns[i];
    setColumns((c) => c.map((col, idx) => (idx === i ? name : col)));
    setRows((rs) =>
      rs.map((row) => {
        const next = { ...row, [name]: row[oldName] ?? "" };
        delete next[oldName];
        return next;
      })
    );
  };

  const removeColumn = (i: number) => {
    const name = columns[i];
    setColumns((c) => c.filter((_, idx) => idx !== i));
    setRows((rs) => rs.map((row) => { const next = { ...row }; delete next[name]; return next; }));
  };

  // ── Row ops ───────────────────────────────────────────────────
  const addRow = () => {
    setRows((rs) => [...rs, Object.fromEntries(columns.map((c) => [c, ""]))]);
  };

  const setCellValue = (rowIdx: number, col: string, val: string) => {
    setRows((rs) => rs.map((row, i) => i === rowIdx ? { ...row, [col]: val } : row));
  };

  const removeRow = (i: number) => {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    const trimmedCols = columns.map((c) => c.trim()).filter(Boolean);
    if (!trimmedCols.length) return;
    onSave({ columns: trimmedCols, rows });
  };

  const isEmpty = columns.length === 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Pipeline
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold">Template Editor</span>
        <span className="text-xs text-muted-foreground">
          {columns.length} column{columns.length !== 1 ? "s" : ""}
          {rows.length > 0 && ` · ${rows.length} example row${rows.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />
        <p className="text-xs text-muted-foreground hidden sm:block">
          Columns = fields Claude will extract. Example rows help guide the format.
        </p>
        <Button size="sm" onClick={handleSave} disabled={isEmpty}>
          Save template
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row handle column */}
              <th className="w-8 border-b border-r bg-muted/60" />
              {columns.map((col, i) => (
                <th key={i} className="border-b border-r bg-muted/60 p-0 min-w-36">
                  <div className="flex items-center gap-1 px-1 py-1">
                    <input
                      ref={i === columns.length - 1 ? newColRef : undefined}
                      value={col}
                      onChange={(e) => renameColumn(i, e.target.value)}
                      className="flex-1 bg-transparent font-semibold text-foreground px-1.5 py-1 rounded focus:outline-none focus:bg-background focus:ring-1 focus:ring-ring min-w-0"
                      placeholder="Column name"
                    />
                    <button
                      onClick={() => removeColumn(i)}
                      className="opacity-0 group-hover:opacity-100 hover:opacity-100 rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </th>
              ))}
              {/* Add column */}
              <th className="border-b bg-muted/60 px-2">
                <button
                  onClick={addColumn}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap py-1"
                >
                  <Plus className="size-3" />
                  <span>Add column</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={cn("group", ri % 2 === 1 && "bg-muted/20")}>
                {/* Row number / delete */}
                <td className="border-b border-r px-1 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <GripVertical className="size-3 text-muted-foreground/30" />
                    <button
                      onClick={() => removeRow(ri)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </td>
                {columns.map((col, ci) => (
                  <td key={ci} className="border-b border-r p-0">
                    <input
                      value={row[col] ?? ""}
                      onChange={(e) => setCellValue(ri, col, e.target.value)}
                      className="w-full bg-transparent px-3 py-1.5 focus:outline-none focus:bg-background focus:ring-inset focus:ring-1 focus:ring-ring"
                      placeholder="example value…"
                    />
                  </td>
                ))}
                <td className="border-b" />
              </tr>
            ))}

            {/* Add row */}
            <tr>
              <td className="px-1 py-2" colSpan={columns.length + 2}>
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="size-3" />
                  Add example row
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-muted-foreground">No columns yet.</p>
            <Button size="sm" variant="outline" onClick={addColumn}>
              <Plus className="size-3" />
              Add first column
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
