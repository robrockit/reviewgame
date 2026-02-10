'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.types';
import type { QuestionBankListItem } from '@/types/question-bank.types';
import { canAccessCustomQuestionBanks } from '@/lib/utils/feature-access';
import { useQuestionBanks } from './hooks/useQuestionBanks';
import QuestionBankCard from './components/QuestionBankCard';
import CreateBankModal from './components/CreateBankModal';
import EditBankModal from './components/EditBankModal';
import DeleteBankModal from './components/DeleteBankModal';
import EmptyBanksState from './components/EmptyBanksState';

type Profile = Tables<'profiles'>;

export default function QuestionBanksPage() {
  const router = useRouter();
  const supabase = createClient();

  const {
    banks,
    loading,
    error: banksError,
    createBank,
    updateBank,
    deleteBank,
    duplicateBank,
  } = useQuestionBanks();

  // User state
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<QuestionBankListItem | null>(null);

  // Toast/notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Feature access
  const canCreate = profile ? canAccessCustomQuestionBanks(profile) : false;

  // Fetch user and profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

        if (userError || !currentUser) {
          router.push('/login');
          return;
        }

        setUser(currentUser);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profileError) {
          console.error('Failed to fetch profile:', profileError);
        } else {
          setProfile(profileData);
        }
      } catch (err) {
        console.error('Failed to initialize page:', err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [router, supabase]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
  };

  // Auto-dismiss toast after 5 seconds with cleanup
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Action handlers
  const handleCreateClick = () => {
    if (!canCreate) {
      showToast('Custom question banks require BASIC or PREMIUM subscription', 'error');
      return;
    }
    setCreateModalOpen(true);
  };

  const handleCreateConfirm = async (data: {
    title: string;
    subject: string;
    description?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }) => {
    await createBank(data);
    showToast('Question bank created successfully');
  };

  const handleEdit = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    if (bank) {
      setSelectedBank(bank);
      setEditModalOpen(true);
    }
  };

  const handleEditConfirm = async (data: {
    title?: string;
    subject?: string;
    description?: string | null;
    difficulty?: 'easy' | 'medium' | 'hard' | null;
  }) => {
    if (selectedBank) {
      await updateBank(selectedBank.id, data);
      showToast('Question bank updated successfully');
    }
  };

  const handleDelete = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    if (bank) {
      setSelectedBank(bank);
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedBank) {
      await deleteBank(selectedBank.id);
      showToast('Question bank deleted successfully');
    }
  };

  const handleDuplicate = async (bankId: string) => {
    if (!canCreate) {
      showToast('Duplicating question banks requires BASIC or PREMIUM subscription', 'error');
      return;
    }

    try {
      await duplicateBank(bankId);
      showToast('Question bank duplicated successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate question bank', 'error');
    }
  };

  const isLoading = loading || profileLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Banks</h1>
              <p className="mt-2 text-sm text-gray-600">
                Create and manage your custom question banks for review games
              </p>
            </div>
            <button
              onClick={handleCreateClick}
              disabled={!canCreate}
              className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                canCreate
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <PlusIcon className="h-5 w-5 mr-2" aria-hidden="true" />
              Create Question Bank
            </button>
          </div>
        </div>

        {/* Upgrade Banner for FREE users */}
        {!isLoading && !canCreate && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-medium">Upgrade to BASIC or PREMIUM</span> to create custom question banks.{' '}
                  <a href="/pricing" className="font-medium underline text-yellow-700 hover:text-yellow-600">
                    View plans
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {banksError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {banksError}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : banks.length === 0 ? (
          // Empty State
          <EmptyBanksState canCreate={canCreate} onCreateClick={handleCreateClick} />
        ) : (
          // Banks Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banks.map((bank) => (
              <QuestionBankCard
                key={bank.id}
                bank={bank}
                isOwner={user?.id === bank.owner_id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50">
            <div
              className={`rounded-md p-4 shadow-lg ${
                toastType === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {toastType === 'success' ? (
                    <svg
                      className="h-5 w-5 text-green-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${toastType === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {toastMessage}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setToastMessage(null)}
                      className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        toastType === 'success'
                          ? 'text-green-500 hover:bg-green-100 focus:ring-green-600'
                          : 'text-red-500 hover:bg-red-100 focus:ring-red-600'
                      }`}
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateBankModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreateConfirm}
      />

      <EditBankModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onConfirm={handleEditConfirm}
        bank={selectedBank}
      />

      <DeleteBankModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        bankTitle={selectedBank?.title || ''}
      />
    </div>
  );
}
