/**
 * @fileoverview Client component for user management functionality.
 *
 * Manages state and orchestrates the search bar, user list table,
 * and pagination components.
 *
 * @module app/admin/users/components/UserManagementClient
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import UserSearchBar from './UserSearchBar';
import UserListTable from './UserListTable';
import Pagination from './Pagination';
import type { AdminUserListItem } from '@/app/api/admin/users/route';

/**
 * Response structure from user list/search APIs
 */
type UserListResponse = {
  data: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  query?: string;
};

/**
 * User management client component.
 *
 * Provides the interactive interface for searching, viewing,
 * and paginating through users.
 */
export default function UserManagementClient() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pagination, setPagination] = useState<UserListResponse['pagination']>({
    page: 1,
    limit: 25,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  /**
   * Fetches the user list from the API
   */
  const fetchUsers = useCallback(async (pageNum: number, limitNum: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/users?page=${pageNum}&limit=${limitNum}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const data: UserListResponse = await response.json();
      setUsers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Searches for users based on query
   */
  const searchUsers = useCallback(async (query: string, pageNum: number, limitNum: number) => {
    if (!query.trim()) {
      // If search is cleared, fetch regular list
      await fetchUsers(pageNum, limitNum);
      setIsSearching(false);
      setSearchQuery('');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsSearching(true);
      setSearchQuery(query);

      const response = await fetch('/api/admin/users/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          page: pageNum,
          limit: limitNum,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search users');
      }

      const data: UserListResponse = await response.json();
      setUsers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error searching users:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  /**
   * Handles search submission.
   * Memoized to prevent unnecessary child component re-renders.
   */
  const handleSearch = useCallback(
    (query: string) => {
      // Reset to first page on new search
      searchUsers(query, 1, pagination.limit);
    },
    [searchUsers, pagination.limit]
  );

  /**
   * Handles clearing search.
   * Memoized to prevent unnecessary child component re-renders.
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    fetchUsers(1, pagination.limit);
  }, [fetchUsers, pagination.limit]);

  /**
   * Handles page change.
   * Memoized to prevent unnecessary child component re-renders.
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isSearching && searchQuery) {
        searchUsers(searchQuery, newPage, pagination.limit);
      } else {
        fetchUsers(newPage, pagination.limit);
      }
    },
    [isSearching, searchQuery, searchUsers, fetchUsers, pagination.limit]
  );

  /**
   * Handles page size (limit) change.
   * Memoized to prevent unnecessary child component re-renders.
   */
  const handleLimitChange = useCallback(
    (newLimit: number) => {
      // Reset to first page when changing limit
      if (isSearching && searchQuery) {
        searchUsers(searchQuery, 1, newLimit);
      } else {
        fetchUsers(1, newLimit);
      }
    },
    [isSearching, searchQuery, searchUsers, fetchUsers]
  );

  /**
   * Initial load - fetch users
   * Only runs on mount to load initial data
   */
  useEffect(() => {
    fetchUsers(1, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <UserSearchBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        isSearching={isSearching}
        searchQuery={searchQuery}
        loading={loading}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* User List Table */}
      <UserListTable
        users={users}
        loading={loading}
        isSearching={isSearching}
        searchQuery={searchQuery}
      />

      {/* Pagination */}
      {!loading && users.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          limit={pagination.limit}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
