/**
 * ChevronLeftIcon Component
 *
 * A reusable left chevron icon used for navigation elements.
 * Commonly used in "back" buttons and breadcrumbs.
 *
 * @example
 * ```tsx
 * <ChevronLeftIcon className="w-5 h-5" />
 * ```
 */

interface ChevronLeftIconProps {
  /** Optional className for custom sizing and styling. Defaults to "w-5 h-5" */
  className?: string;
}

export function ChevronLeftIcon({ className = "w-5 h-5" }: ChevronLeftIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}
