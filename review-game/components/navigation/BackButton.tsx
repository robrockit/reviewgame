'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@/components/icons/ChevronLeftIcon';

/**
 * BackButton Component
 *
 * A reusable navigation button for returning to previous pages.
 * Includes proper accessibility attributes and consistent styling.
 *
 * @example
 * ```tsx
 * // Default (secondary variant, "Back to Dashboard" label)
 * <BackButton href="/dashboard" />
 *
 * // Primary variant (blue)
 * <BackButton href="/dashboard" variant="primary" />
 *
 * // Text-only variant
 * <BackButton href="/dashboard" variant="text" />
 *
 * // Custom label
 * <BackButton href="/games" label="Back to Games" />
 * ```
 */

interface BackButtonProps {
  /** The URL to navigate to when clicked */
  href: string;
  /** The text label for the button. Defaults to "Back to Dashboard" */
  label?: string;
  /** Optional aria-label override. If not provided, uses the label directly */
  ariaLabel?: string;
  /** The visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'text';
  /** Additional CSS classes to apply */
  className?: string;
}

export function BackButton({
  href,
  label = "Back to Dashboard",
  ariaLabel,
  variant = 'secondary',
  className = ''
}: BackButtonProps) {
  const router = useRouter();

  // Variant-specific styling with focus indicators for keyboard accessibility
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
    text: 'text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:rounded'
  };

  return (
    <button
      onClick={() => router.push(href)}
      className={`transition-colors font-medium flex items-center gap-2 ${variantStyles[variant]} ${className}`}
      aria-label={ariaLabel || label}
      type="button"
    >
      <ChevronLeftIcon />
      {label}
    </button>
  );
}
