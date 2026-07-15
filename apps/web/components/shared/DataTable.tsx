"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  width?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  rowActions,
  onRowClick,
  selectable,
  onSelectionChange,
  pageSize = 10,
  emptyTitle = "Sin resultados",
  emptyDescription,
  className,
}: {
  columns: Column<T>[];
  data: T[];
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const arr = [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = sorted.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      onSelectionChange?.(next);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allOnPage = paged.map((r) => r.id);
    const allSelected = allOnPage.every((id) => selected.includes(id));
    const next = allSelected
      ? selected.filter((id) => !allOnPage.includes(id))
      : Array.from(new Set([...selected, ...allOnPage]));
    setSelected(next);
    onSelectionChange?.(next);
  };

  return (
    <div
      className={cn(
        "premium-card overflow-hidden rounded-2xl border border-border/80 bg-surface",
        className,
      )}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-600">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={
                      paged.length > 0 &&
                      paged.every((r) => selected.includes(r.id))
                    }
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-strong accent-brand-600"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3.5 text-left text-[12px] font-semibold tracking-normal text-white/85",
                    col.headerClassName,
                  )}
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-text-primary"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && <th className="w-10 px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border-subtle transition-colors last:border-0 odd:bg-white even:bg-surface-muted/45",
                  onRowClick && "cursor-pointer",
                  "hover:bg-brand-50",
                )}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td className="px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="h-4 w-4 rounded border-border-strong accent-brand-600"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-text-primary", col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className="px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paged.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5">
          <span className="text-xs text-text-muted">
            {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, sorted.length)} de{" "}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-text-primary">
              {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
