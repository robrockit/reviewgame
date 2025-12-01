/**
 * @fileoverview User search bar component.
 *
 * Provides a search input for finding users by email, name, or user ID.
 * Features:
 * - Live search with debounce
 * - Clear search button
 * - Loading state indicator
 * - Search suggestions/placeholder
 *
 * @module app/admin/users/components/UserSearchBar
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface UserSearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  isSearching: boolean;
  searchQuery: string;
  loading: boolean;
}

/**
 * User search bar component.
 *
 * Provides an input field for searching users with debouncing
 * to reduce API calls during typing.
 */
export default function UserSearchBar({
  onSearch,
  onClear,
  isSearching,
  searchQuery,
  loading,
}: UserSearchBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update local query when prop changes (e.g., from clear)
  // Also clear any pending debounce to prevent stale searches
  useEffect(() => {
    setLocalQuery(searchQuery);

    // Clear any pending debounce when search query changes externally
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }
  }, [searchQuery]);

  /**
   * Handles input change with debouncing
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout for debounced search
    debounceTimeout.current = setTimeout(() => {
      if (value.trim()) {
        onSearch(value.trim());
      } else {
        onClear();
      }
    }, 500); // 500ms debounce
  };

  /**
   * Handles manual search submission (Enter key)
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (localQuery.trim()) {
      onSearch(localQuery.trim());
    } else {
      onClear();
    }
  };

  /**
   * Handles clear button click
   */
  const handleClear = () => {
    setLocalQuery('');

    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    onClear();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            {/* Search Icon */}
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={localQuery}
              onChange={handleInputChange}
              placeholder="Search by email, name, or user ID..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              disabled={loading}
            />

            {/* Clear Button */}
            {localQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            type="submit"
            disabled={loading || !localQuery.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Search Status */}
        {isSearching && searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Searching for: <span className="font-medium">{searchQuery}</span>
          </div>
        )}
      </form>
    </div>
  );
}
