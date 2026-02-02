/**
 * @fileoverview Game header component for teacher control panel.
 *
 * Provides fixed navigation header with:
 * - Logo/brand link to dashboard
 * - Game title (responsive truncation)
 * - Dashboard navigation with game status checks
 * - End Game button
 * - User profile dropdown
 * - Mobile hamburger menu
 *
 * @module components/teacher/GameHeader
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';
import UserProfileMenu from './UserProfileMenu';

interface GameHeaderProps {
  gameTitle: string;
  gameStatus: string;
  hasConnectedTeams: boolean;
  teamCount: number;
  onEndGame: () => void;
}

/**
 * Game header component for teacher control panel.
 *
 * Provides a fixed navigation header with conditional warnings for active games.
 * Matches admin header pattern with responsive mobile menu.
 */
export default function GameHeader({
  gameTitle,
  gameStatus,
  hasConnectedTeams,
  teamCount,
  onEndGame,
}: GameHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Handles dashboard navigation click.
   * Shows warning modal if game has connected teams, otherwise redirects immediately.
   */
  const handleDashboardClick = () => {
    // Setup phase (no connected teams) - immediate redirect
    if (!hasConnectedTeams) {
      router.push('/dashboard');
      return;
    }

    // Active game - show end game confirmation modal
    onEndGame();
  };

  /**
   * Truncates game title based on screen size.
   * Desktop: 40 chars, Tablet: 30 chars, Mobile: 20 chars
   */
  const truncateTitle = (title: string, maxLength: number) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Mobile menu button (left) */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Logo/Brand (desktop only) */}
          <div className="hidden lg:flex items-center">
            <button
              onClick={handleDashboardClick}
              className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Review Game
            </button>
          </div>

          {/* Game Title (center) */}
          <div className="flex-1 text-center lg:text-left lg:ml-8">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 truncate lg:max-w-[40ch] md:max-w-[30ch] max-w-[20ch] mx-auto lg:mx-0">
              <span className="hidden lg:inline">{truncateTitle(gameTitle, 40)}</span>
              <span className="hidden md:inline lg:hidden">{truncateTitle(gameTitle, 30)}</span>
              <span className="inline md:hidden">{truncateTitle(gameTitle, 20)}</span>
            </h1>
            <p className="text-xs text-gray-500 capitalize">
              {gameStatus === 'setup' ? 'Setup' : gameStatus === 'active' || gameStatus === 'in_progress' ? 'Active' : gameStatus}
            </p>
          </div>

          {/* Desktop Actions (right) */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Dashboard Link */}
            <button
              onClick={handleDashboardClick}
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Dashboard
            </button>

            {/* End Game Button */}
            <button
              onClick={onEndGame}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              aria-label="End game and return to dashboard"
            >
              End Game
            </button>

            {/* User Profile */}
            <UserProfileMenu />
          </div>

          {/* Mobile Profile Icon (right) */}
          <div className="lg:hidden">
            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <Transition show={mobileMenuOpen} as={Fragment}>
        <div className="relative z-50 lg:hidden">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setMobileMenuOpen(false)} />
          </Transition.Child>

          {/* Menu Panel */}
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-xl">
              {/* Menu Header */}
              <div className="flex h-16 items-center justify-between px-4 border-b">
                <span className="text-xl font-bold text-blue-600">Review Game</span>
                <button
                  type="button"
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close menu</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <nav className="space-y-2">
                  {/* Dashboard Link */}
                  <button
                    onClick={() => {
                      handleDashboardClick();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                  >
                    Dashboard
                  </button>

                  {/* End Game Button */}
                  <button
                    onClick={() => {
                      onEndGame();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                  >
                    End Game
                  </button>

                  {/* Divider */}
                  <div className="border-t my-4" />

                  {/* Game Info */}
                  <div className="px-4 py-2 text-sm">
                    <p className="text-gray-500">Game Status</p>
                    <p className="font-medium text-gray-900 capitalize">{gameStatus}</p>
                  </div>
                  <div className="px-4 py-2 text-sm">
                    <p className="text-gray-500">Teams</p>
                    <p className="font-medium text-gray-900">
                      {teamCount} {hasConnectedTeams ? '(Active)' : '(Waiting)'}
                    </p>
                  </div>
                </nav>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </>
  );
}
