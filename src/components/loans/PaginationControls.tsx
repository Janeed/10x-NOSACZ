import type { ChangeEvent, FC } from "react";

import { Button } from "@/components/ui/button";
import type { PaginationState } from "@/lib/viewModels/loans";

interface PaginationControlsProps {
  readonly pagination: PaginationState;
  readonly onChangePage: (page: number) => void;
  readonly onChangePageSize: (size: number) => void;
  readonly isDisabled?: boolean;
  readonly pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

export const PaginationControls: FC<PaginationControlsProps> = ({
  pagination,
  onChangePage,
  onChangePageSize,
  isDisabled,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) => {
  const { page, totalPages, pageSize, totalItems } = pagination;
  const clampedPage = Math.max(page, 1);
  const maxPages = Math.max(totalPages, 1);
  const isFirstPage = clampedPage <= 1;
  const isLastPage = clampedPage >= maxPages;

  const handlePrevious = () => {
    onChangePage(clampedPage - 1);
  };

  const handleNext = () => {
    onChangePage(clampedPage + 1);
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSize = Number.parseInt(event.target.value, 10);
    if (Number.isFinite(nextSize)) {
      onChangePageSize(nextSize);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span>
          Page <span className="font-medium text-slate-900">{clampedPage}</span>{" "}
          of {maxPages}
        </span>
        <span aria-hidden="true">·</span>
        <span>{totalItems} total</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handlePrevious}
          disabled={isDisabled || isFirstPage}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleNext}
          disabled={isDisabled || isLastPage}
        >
          Next
        </Button>
      </div>
      <label
        className="flex items-center gap-2 text-xs font-medium text-slate-500"
        htmlFor="loan-page-size"
      >
        Page size
        <select
          id="loan-page-size"
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={isDisabled}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
