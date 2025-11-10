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
  /** The visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'text';
  /** Additional CSS classes to apply */
  className?: string;
}

export function BackButton({
  href,
  label = "Back to Dashboard",
  variant = 'secondary',
  className = ''
}: BackButtonProps) {
  const router = useRouter();

  // Variant-specific styling
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg',
    text: 'text-indigo-600 hover:text-indigo-800'
  };

  return (
    <button
      onClick={() => router.push(href)}
      className={`transition-colors font-medium flex items-center gap-2 ${variantStyles[variant]} ${className}`}
      aria-label={`Return to ${label.toLowerCase()}`}
      type="button"
    >
      <ChevronLeftIcon />
      {label}
    </button>
  );
}
