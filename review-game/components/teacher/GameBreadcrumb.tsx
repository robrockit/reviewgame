/**
 * @fileoverview Breadcrumb navigation component for game pages.
 *
 * Provides breadcrumb trail:
 * Home > Dashboard > Games > [Game Title]
 *
 * Hidden on mobile, visible on tablet and desktop.
 *
 * @module components/teacher/GameBreadcrumb
 */

'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface GameBreadcrumbProps {
  gameTitle: string;
}

/**
 * Game breadcrumb navigation component.
 *
 * Displays hierarchical navigation path with links.
 * Truncates game title to prevent overflow.
 */
export default function GameBreadcrumb({ gameTitle }: GameBreadcrumbProps) {
  // Truncate game title if too long
  const truncatedTitle = gameTitle.length > 20
    ? gameTitle.substring(0, 20) + '...'
    : gameTitle;

  return (
    <nav className="hidden md:flex items-center space-x-2 text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
      {/* Home */}
      <Link
        href="/"
        className="hover:text-gray-700 transition-colors"
      >
        Home
      </Link>

      <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />

      {/* Dashboard */}
      <Link
        href="/dashboard"
        className="hover:text-gray-700 transition-colors"
      >
        Dashboard
      </Link>

      <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />

      {/* Games */}
      <Link
        href="/dashboard/games"
        className="hover:text-gray-700 transition-colors"
      >
        Games
      </Link>

      <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />

      {/* Current Game */}
      <span className="text-gray-900 font-medium truncate max-w-[20ch]" title={gameTitle}>
        {truncatedTitle}
      </span>
    </nav>
  );
}
