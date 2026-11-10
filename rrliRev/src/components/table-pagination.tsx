"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

export type TablePaginationProps = {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemLabel?: string;
  itemCountInPage?: number;
};

export function TablePagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  loading = false,
  itemLabel = "items",
  itemCountInPage,
}: TablePaginationProps) {
  const [inputValue, setInputValue] = useState(String(page));

  // Sync internal input text when external page prop changes
  useEffect(() => {
    setInputValue(String(page));
  }, [page]);

  const safePageCount = Math.max(1, pageCount);
  const displayedCount = itemCountInPage ?? Math.min(pageSize, Math.max(0, totalItems - (page - 1) * pageSize));

  function commitPageChange(raw: string) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) {
      setInputValue(String(page));
      return;
    }
    const clamped = Math.max(1, Math.min(safePageCount, parsed));
    setInputValue(String(clamped));
    if (clamped !== page) {
      onPageChange(clamped);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPageChange(inputValue);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setInputValue(String(page));
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleBlur() {
    commitPageChange(inputValue);
  }

  return (
    <div className="table-footer">
      <span>
        Showing {displayedCount} of {totalItems} {itemLabel}
      </span>
      <div className="pagination" aria-label="Table pagination">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
          title="Go to previous page"
        >
          ‹
        </button>

        <div className="pagination-input-wrap">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={safePageCount}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={loading || safePageCount <= 1}
            className="pagination-page-input no-spin-stepper"
            aria-label="Current page number"
            title="Type page number and press Enter to jump"
          />
          <span>of {safePageCount}</span>
        </div>

        <button
          type="button"
          disabled={page >= safePageCount || loading}
          onClick={() => onPageChange(Math.min(safePageCount, page + 1))}
          aria-label="Next page"
          title="Go to next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
