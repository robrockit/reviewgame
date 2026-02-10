'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  QueueListIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import type { QuestionBankListItem } from '@/types/question-bank.types';

interface QuestionBankCardProps {
  bank: QuestionBankListItem;
  isOwner: boolean;
  onEdit: (bankId: string) => void;
  onDelete: (bankId: string) => void;
  onDuplicate: (bankId: string) => void;
}

export default function QuestionBankCard({
  bank,
  isOwner,
  onEdit,
  onDelete,
  onDuplicate,
}: QuestionBankCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Difficulty badge color
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        {/* Header with Title and Menu */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link
              href={`/dashboard/question-banks/${bank.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {bank.title}
            </Link>
            <p className="mt-1 text-sm text-gray-600">{bank.subject}</p>
          </div>

          {/* Actions Menu */}
          <Menu as="div" className="relative ml-3">
            <Menu.Button
              className="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="sr-only">Open options</span>
              <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  {/* Manage Questions */}
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href={`/dashboard/question-banks/${bank.id}`}
                        className={`${
                          active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        } flex items-center px-4 py-2 text-sm`}
                      >
                        <QueueListIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Manage Questions
                      </Link>
                    )}
                  </Menu.Item>

                  {/* Edit (owner only) */}
                  {isOwner && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onEdit(bank.id)}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } flex items-center w-full px-4 py-2 text-sm text-left`}
                        >
                          <PencilIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                          Edit Details
                        </button>
                      )}
                    </Menu.Item>
                  )}

                  {/* Duplicate */}
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => onDuplicate(bank.id)}
                        className={`${
                          active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        } flex items-center w-full px-4 py-2 text-sm text-left`}
                      >
                        <DocumentDuplicateIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Duplicate
                      </button>
                    )}
                  </Menu.Item>

                  {/* Delete (owner only) */}
                  {isOwner && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => onDelete(bank.id)}
                          className={`${
                            active ? 'bg-red-100 text-red-900' : 'text-red-700'
                          } flex items-center w-full px-4 py-2 text-sm text-left`}
                        >
                          <TrashIcon className="mr-3 h-5 w-5 text-red-400" aria-hidden="true" />
                          Delete
                        </button>
                      )}
                    </Menu.Item>
                  )}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        {/* Description */}
        {bank.description && (
          <p className="mt-3 text-sm text-gray-500 line-clamp-2">{bank.description}</p>
        )}

        {/* Badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Public/Custom Badge */}
          {bank.is_public ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <GlobeAltIcon className="mr-1 h-3 w-3" aria-hidden="true" />
              Public
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <LockClosedIcon className="mr-1 h-3 w-3" aria-hidden="true" />
              Custom
            </span>
          )}

          {/* Difficulty Badge */}
          {bank.difficulty && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(bank.difficulty)}`}>
              {bank.difficulty.charAt(0).toUpperCase() + bank.difficulty.slice(1)}
            </span>
          )}

          {/* Question Count Badge */}
          {bank.question_count !== undefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {bank.question_count} {bank.question_count === 1 ? 'question' : 'questions'}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <Link
          href={`/dashboard/question-banks/${bank.id}`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Manage Questions →
        </Link>
      </div>
    </div>
  );
}
