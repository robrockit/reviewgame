'use client';

import Link from 'next/link';
import { PuzzlePieceIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface EmptyGamesStateProps {
  hasSearch: boolean;
}

export default function EmptyGamesState({ hasSearch }: EmptyGamesStateProps) {
  if (hasSearch) {
    return (
      <div className="text-center py-12 px-4">
        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No games found</h3>
        <p className="mt-2 text-sm text-gray-500">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-4">
      <PuzzlePieceIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">No games yet</h3>
      <p className="mt-2 text-sm text-gray-500">
        Get started by creating your first review game
      </p>
      <div className="mt-6">
        <Link
          href="/dashboard/games/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Create Your First Game
        </Link>
      </div>
    </div>
  );
}
