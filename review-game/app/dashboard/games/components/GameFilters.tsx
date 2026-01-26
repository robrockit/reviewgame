'use client';

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import type { GameFilters as GameFiltersType } from '@/types/game.types';

interface GameFiltersProps {
  filters: GameFiltersType;
  onFiltersChange: (filters: GameFiltersType) => void;
}

export default function GameFilters({ filters, onFiltersChange }: GameFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput, page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger on searchInput change
  }, [searchInput]);

  const handleStatusChange = (status: GameFiltersType['status']) => {
    onFiltersChange({ ...filters, status, page: 1 });
  };

  const handleSortChange = (sort: GameFiltersType['sort']) => {
    onFiltersChange({ ...filters, sort, page: 1 });
  };

  const handleOrderToggle = () => {
    const newOrder = filters.order === 'asc' ? 'desc' : 'asc';
    onFiltersChange({ ...filters, order: newOrder });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    onFiltersChange({
      search: '',
      status: 'all',
      sort: 'created_at',
      order: 'desc',
      page: 1,
    });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.sort !== 'created_at' || filters.order !== 'desc';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by game name or subject..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="w-full lg:w-48">
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value as GameFiltersType['status'])}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="setup">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="w-full lg:w-48">
          <select
            value={filters.sort}
            onChange={(e) => handleSortChange(e.target.value as GameFiltersType['sort'])}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
          >
            <option value="created_at">Date Created</option>
            <option value="bank_title">Name</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Order Toggle Button */}
        <div className="flex gap-2">
          <button
            onClick={handleOrderToggle}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title={filters.order === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowsUpDownIcon className="h-5 w-5" aria-hidden="true" />
            <span className="ml-2">{filters.order === 'asc' ? 'Asc' : 'Desc'}</span>
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              <span className="ml-2">Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
