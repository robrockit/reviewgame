'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.types';
import type { Question } from '@/types/question-bank.types';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { useQuestions } from '../hooks/useQuestions';
import QuestionGrid from '../components/QuestionGrid';
import CreateQuestionModal from '../components/CreateQuestionModal';
import DeleteQuestionModal from '../components/DeleteQuestionModal';

type Profile = Tables<'profiles'>;
type QuestionBank = Tables<'question_banks'>;

export default function QuestionBankDetailPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const unwrappedParams = use(params);
  const bankId = unwrappedParams.bankId;
  const router = useRouter();
  const supabase = createClient();

  const {
    gridData,
    loading: questionsLoading,
    error: questionsError,
    createQuestion,
    deleteQuestion,
    getCategories,
  } = useQuestions({ bankId });

  // User and bank state
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [bankLoading, setBankLoading] = useState(true);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPointValue, setSelectedPointValue] = useState<number>(100);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Feature access
  const canAddImages = profile ? canAccessVideoImages(profile) : false;
  const isOwner = user && bank ? user.id === bank.owner_id : false;

  // Fetch user and bank
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch bank
        const { data: bankData, error: bankError } = await supabase
          .from('question_banks')
          .select('*')
          .eq('id', bankId)
          .single();

        if (bankError) {
          console.error('Failed to fetch question bank:', bankError);
          router.push('/dashboard/question-banks');
        } else {
          setBank(bankData);

          // Check access (public OR owned)
          if (!bankData.is_public && bankData.owner_id !== currentUser.id) {
            console.error('Access denied to this question bank');
            router.push('/dashboard/question-banks');
          }
        }
      } catch (err) {
        console.error('Failed to initialize page:', err);
      } finally {
        setBankLoading(false);
      }
    };

    fetchData();
  }, [bankId, router, supabase]);

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
  const handleCellClick = (category: string, pointValue: number) => {
    if (!isOwner) {
      showToast('Only the owner can edit questions', 'error');
      return;
    }

    const question = gridData[category]?.[pointValue];

    if (question) {
      // Edit existing question
      setSelectedQuestion(question);
      setDeleteModalOpen(true);
    } else {
      // Add new question
      setSelectedCategory(category);
      setSelectedPointValue(pointValue);
      setCreateModalOpen(true);
    }
  };

  const handleCreateConfirm = async (data: {
    category: string;
    point_value: number;
    question_text: string;
    answer_text: string;
    teacher_notes?: string;
    image_url?: string;
  }) => {
    await createQuestion(data);
    showToast('Question added successfully');
  };

  const handleDeleteConfirm = async () => {
    if (selectedQuestion) {
      await deleteQuestion(selectedQuestion.id);
      showToast('Question deleted successfully');
    }
  };

  const isLoading = bankLoading || questionsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/question-banks"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" aria-hidden="true" />
            Back to Question Banks
          </Link>

          {bank && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{bank.title}</h1>
              <div className="mt-2 flex items-center gap-4">
                <p className="text-sm text-gray-600">{bank.subject}</p>
                {bank.difficulty && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {bank.difficulty.charAt(0).toUpperCase() + bank.difficulty.slice(1)}
                  </span>
                )}
                {!isOwner && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Read-only
                  </span>
                )}
              </div>
              {bank.description && (
                <p className="mt-3 text-sm text-gray-600">{bank.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Read-only Warning */}
        {!isOwner && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  This is a {bank?.is_public ? 'public' : 'shared'} question bank. You can view it but cannot make changes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {questionsError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {questionsError}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="grid grid-cols-7 gap-2">
                {[...Array(35)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Question Grid
          <QuestionGrid
            gridData={gridData}
            categories={getCategories()}
            isEditable={isOwner}
            onCellClick={handleCellClick}
          />
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
      <CreateQuestionModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreateConfirm}
        categories={getCategories()}
        initialCategory={selectedCategory}
        initialPointValue={selectedPointValue}
        canAddImages={canAddImages}
      />

      <DeleteQuestionModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        question={selectedQuestion}
      />
    </div>
  );
}
