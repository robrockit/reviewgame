'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useGames } from './hooks/useGames';
import GameFilters from './components/GameFilters';
import GameListView from './components/GameListView';
import GameListSkeleton from './components/GameListSkeleton';
import ShareGameModal from './components/ShareGameModal';
import DeleteGameModal from './components/DeleteGameModal';
import DuplicateGameModal from './components/DuplicateGameModal';

export default function GamesPage() {
  const router = useRouter();
  const {
    games,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    deleteGame,
    duplicateGame,
  } = useGames();

  // Modal states
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Action handlers
  const handleLaunch = (gameId: string) => {
    router.push(`/game/teacher/${gameId}`);
  };

  const handleEdit = (gameId: string) => {
    router.push(`/dashboard/games/${gameId}/edit`);
  };

  const handleDuplicate = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (game) {
      setSelectedGame({ id: game.id, title: game.bank_title });
      setDuplicateModalOpen(true);
    }
  };

  const handleShare = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (game) {
      setSelectedGame({ id: game.id, title: game.bank_title });
      setShareModalOpen(true);
    }
  };

  const handleDelete = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (game) {
      setSelectedGame({ id: game.id, title: game.bank_title });
      setDeleteModalOpen(true);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (selectedGame) {
      await duplicateGame(selectedGame.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedGame) {
      await deleteGame(selectedGame.id);
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (pagination && pagination.hasPreviousPage) {
      updateFilters({ page: filters.page - 1 });
    }
  };

  const handleNextPage = () => {
    if (pagination && pagination.hasNextPage) {
      updateFilters({ page: filters.page + 1 });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Games</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage your review games and launch them with your students
              </p>
            </div>
            <Link
              href="/dashboard/games/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true" />
              Create Game
            </Link>
          </div>
        </div>

        {/* Filters */}
        <GameFilters filters={filters} onFiltersChange={updateFilters} />

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Games List */}
        {loading ? (
          <GameListSkeleton />
        ) : (
          <GameListView
            games={games}
            onLaunch={handleLaunch}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onShare={handleShare}
            onDelete={handleDelete}
            hasSearch={!!filters.search}
          />
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={handlePreviousPage}
                disabled={!pagination.hasPreviousPage}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span> (
                  <span className="font-medium">{pagination.totalCount}</span> total games)
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={handlePreviousPage}
                    disabled={!pagination.hasPreviousPage}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={!pagination.hasNextPage}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedGame && (
        <>
          <ShareGameModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            gameId={selectedGame.id}
            gameTitle={selectedGame.title}
          />
          <DeleteGameModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            gameTitle={selectedGame.title}
          />
          <DuplicateGameModal
            isOpen={duplicateModalOpen}
            onClose={() => setDuplicateModalOpen(false)}
            onConfirm={handleConfirmDuplicate}
            gameTitle={selectedGame.title}
          />
        </>
      )}
    </div>
  );
}
