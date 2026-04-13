"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipeline";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SpreadsheetViewer() {
  const { previewData, setPreviewData } = usePipelineStore();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!previewData || !query.trim()) return previewData?.rows ?? [];
    const q = query.toLowerCase();
    return previewData.rows.filter((row) =>
      Object.values(row).some((v) => v.toLowerCase().includes(q))
    );
  }, [previewData, query]);

  if (!previewData) return null;

  const { name, columns, rows } = previewData;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <button
          onClick={() => setPreviewData(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Pipeline
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold truncate">{name}</span>
        <span className="text-xs text-muted-foreground ml-1">
          {filtered.length !== rows.length
            ? `${filtered.length} of ${rows.length} rows`
            : `${rows.length} row${rows.length !== 1 ? "s" : ""}`}
          {" · "}
          {columns.length} col{columns.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            className="h-7 pl-8 pr-7 text-xs"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row number header */}
              <th className="w-10 shrink-0 border-b border-r bg-muted/60 px-2 py-2 text-right text-muted-foreground font-normal select-none" />
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-r bg-muted/60 px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No rows match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={i} className={cn("group", i % 2 === 1 && "bg-muted/20")}>
                  <td className="border-b border-r px-2 py-1.5 text-right text-muted-foreground/50 select-none tabular-nums">
                    {i + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="border-b border-r px-3 py-1.5 text-foreground whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                      title={row[col]}
                    >
                      {row[col] ?? ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
