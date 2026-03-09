'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { QUESTION_VALIDATION } from '@/lib/constants/question-banks';
import type { Question, QuestionFormData } from '@/types/question-bank.types';
import { useQuestionForm } from '../hooks/useQuestionForm';

interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: QuestionFormData) => Promise<void>;
  onDeleteRequest: () => void;
  question: Question;
  categories: string[];
  canAddImages: boolean;
}

export default function EditQuestionModal({
  isOpen,
  onClose,
  onConfirm,
  onDeleteRequest,
  question,
  categories,
  canAddImages,
}: EditQuestionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    category, setCategory,
    useExistingCategory, setUseExistingCategory,
    pointValue, setPointValue,
    questionText, setQuestionText,
    answerText, setAnswerText,
    teacherNotes, setTeacherNotes,
    imageUrl, setImageUrl,
    categoryError,
    questionTextError,
    answerTextError,
    imageUrlError,
    initForm,
    validateForm,
    buildPayload,
  } = useQuestionForm();

  // Pre-populate from question prop on each open
  useEffect(() => {
    if (isOpen) {
      initForm({
        category: question.category,
        useExistingCategory: categories.includes(question.category),
        pointValue: question.point_value,
        questionText: question.question_text,
        answerText: question.answer_text,
        teacherNotes: question.teacher_notes ?? '',
        imageUrl: question.image_url ?? '',
      });
      setError(null);
    }
  }, [isOpen, question, categories, initForm]);

  const handleConfirm = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(buildPayload());
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update question';
      setError(errorMessage);
      console.error('Failed to update question:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                    <PencilSquareIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="ml-4 mt-0 text-left flex-1">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Edit Question
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Update the details for this question.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-2">
                  {/* Category */}
                  <div>
                    <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>

                    {categories.length > 0 && (
                      <div className="flex items-center mb-2 space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="edit-category-mode"
                            value="existing"
                            checked={useExistingCategory}
                            onChange={() => setUseExistingCategory(true)}
                            className="form-radio h-4 w-4 text-indigo-600"
                            disabled={isSubmitting}
                          />
                          <span className="ml-2 text-sm">Use existing</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="edit-category-mode"
                            value="new"
                            checked={!useExistingCategory}
                            onChange={() => setUseExistingCategory(false)}
                            className="form-radio h-4 w-4 text-indigo-600"
                            disabled={isSubmitting}
                          />
                          <span className="ml-2 text-sm">Create new</span>
                        </label>
                      </div>
                    )}

                    {useExistingCategory && categories.length > 0 ? (
                      <select
                        id="edit-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          categoryError
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`}
                        disabled={isSubmitting}
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="edit-category"
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          categoryError
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`}
                        placeholder="e.g., Science"
                        maxLength={QUESTION_VALIDATION.CATEGORY_MAX_LENGTH}
                        disabled={isSubmitting}
                      />
                    )}
                    {categoryError && (
                      <p className="mt-1 text-sm text-red-600">{categoryError}</p>
                    )}
                  </div>

                  {/* Point Value */}
                  <div>
                    <label htmlFor="edit-pointValue" className="block text-sm font-medium text-gray-700">
                      Point Value <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit-pointValue"
                      value={pointValue}
                      onChange={(e) => setPointValue(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      disabled={isSubmitting}
                    >
                      {QUESTION_VALIDATION.POINT_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label htmlFor="edit-questionText" className="block text-sm font-medium text-gray-700">
                      Question <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="edit-questionText"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      rows={3}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        questionTextError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                      placeholder="Enter the question text"
                      maxLength={QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH}
                      disabled={isSubmitting}
                    />
                    {questionTextError && (
                      <p className="mt-1 text-sm text-red-600">{questionTextError}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {questionText.length}/{QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH} characters
                    </p>
                  </div>

                  {/* Answer Text */}
                  <div>
                    <label htmlFor="edit-answerText" className="block text-sm font-medium text-gray-700">
                      Answer <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="edit-answerText"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={2}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        answerTextError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                      placeholder="Enter the answer"
                      maxLength={QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH}
                      disabled={isSubmitting}
                    />
                    {answerTextError && (
                      <p className="mt-1 text-sm text-red-600">{answerTextError}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {answerText.length}/{QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH} characters
                    </p>
                  </div>

                  {/* Teacher Notes */}
                  <div>
                    <label htmlFor="edit-teacherNotes" className="block text-sm font-medium text-gray-700">
                      Teacher Notes (optional)
                    </label>
                    <textarea
                      id="edit-teacherNotes"
                      value={teacherNotes}
                      onChange={(e) => setTeacherNotes(e.target.value)}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Private notes for yourself"
                      maxLength={QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH}
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {teacherNotes.length}/{QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH} characters
                    </p>
                  </div>

                  {/* Image URL */}
                  <div>
                    <label htmlFor="edit-imageUrl" className="flex items-center text-sm font-medium text-gray-700">
                      Image URL (optional)
                      {!canAddImages && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          BASIC/PREMIUM Only
                        </span>
                      )}
                    </label>
                    <input
                      type="url"
                      id="edit-imageUrl"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        imageUrlError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                      placeholder="https://example.com/image.jpg"
                      disabled={isSubmitting || !canAddImages}
                    />
                    {imageUrlError && (
                      <p className="mt-1 text-sm text-red-600">{imageUrlError}</p>
                    )}
                    {!canAddImages && (
                      <p className="mt-1 text-xs text-yellow-700">
                        Upgrade to BASIC or PREMIUM to add images to questions
                      </p>
                    )}
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Actions — 3-column: Delete | Cancel | Save Changes */}
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-3 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-base font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onDeleteRequest}
                    disabled={isSubmitting}
                  >
                    Delete Question
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
