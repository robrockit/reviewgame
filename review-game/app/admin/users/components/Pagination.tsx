/**
 * @fileoverview Pagination component for user list.
 *
 * Provides pagination controls with:
 * - Page navigation (previous/next, first/last)
 * - Page number display
 * - Results per page selector (25, 50, 100)
 * - Total results counter
 *
 * @module app/admin/users/components/Pagination
 */

'use client';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/**
 * Pagination component.
 *
 * Provides controls for navigating through paginated user lists.
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalCount,
  limit,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const startResult = (currentPage - 1) * limit + 1;
  const endResult = Math.min(currentPage * limit, totalCount);

  /**
   * Handles limit change from dropdown
   */
  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(e.target.value, 10);
    onLimitChange(newLimit);
  };

  /**
   * Generates page number buttons to display
   * Shows: [1] ... [current-1] [current] [current+1] ... [last]
   */
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages if there are few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const leftBound = Math.max(2, currentPage - 1);
      const rightBound = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis after first page if needed
      if (leftBound > 2) {
        pages.push('...');
      }

      // Add pages around current page
      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (rightBound < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="bg-white shadow-sm rounded-lg px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
        {/* Results Info */}
        <div className="flex items-center space-x-4">
          <p className="text-sm text-gray-700">
            Showing{' '}
            <span className="font-medium">{startResult}</span>
            {' '}-{' '}
            <span className="font-medium">{endResult}</span>
            {' '}of{' '}
            <span className="font-medium">{totalCount}</span>
            {' '}results
          </p>

          {/* Results per page selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="limit" className="text-sm text-gray-700">
              Per page:
            </label>
            <select
              id="limit"
              value={limit}
              onChange={handleLimitChange}
              className="block w-20 rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center space-x-2">
          {/* First Page Button */}
          <button
            onClick={() => onPageChange(1)}
            disabled={!hasPreviousPage}
            className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            title="First page"
          >
            <span className="sr-only">First page</span>
            <ChevronDoubleLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Previous Page Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
            className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            title="Previous page"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Page Numbers */}
          <div className="hidden sm:flex space-x-1">
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isCurrentPage = pageNum === currentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 rounded-md border text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 ${
                    isCurrentPage
                      ? 'z-10 bg-purple-600 border-purple-600 text-white'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Mobile: Just show current page */}
          <div className="sm:hidden">
            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {/* Next Page Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            title="Next page"
          >
            <span className="sr-only">Next</span>
            <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Last Page Button */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNextPage}
            className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            title="Last page"
          >
            <span className="sr-only">Last page</span>
            <ChevronDoubleRightIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
