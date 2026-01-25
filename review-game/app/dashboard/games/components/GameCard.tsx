'use client';

import { format } from 'date-fns';
import type { GameListItem } from '@/types/game.types';
import GameActions from './GameActions';

interface GameCardProps {
  game: GameListItem;
  onLaunch: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export default function GameCard({
  game,
  onLaunch,
  onEdit,
  onDuplicate,
  onShare,
  onDelete,
}: GameCardProps) {
  // Determine status badge color and text
  const getStatusBadge = () => {
    switch (game.status) {
      case 'setup':
        return {
          color: 'bg-gray-100 text-gray-800',
          text: 'Not Started',
        };
      case 'in_progress':
        return {
          color: 'bg-blue-100 text-blue-800',
          text: 'In Progress',
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800',
          text: 'Completed',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          text: 'Unknown',
        };
    }
  };

  const statusBadge = getStatusBadge();

  // Format created date
  const formattedDate = game.created_at
    ? format(new Date(game.created_at), 'MMM d, yyyy')
    : 'Unknown';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {game.bank_title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{game.bank_subject}</p>
          </div>
          <GameActions
            onLaunch={onLaunch}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onShare={onShare}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Status Badge */}
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
          >
            {statusBadge.text}
          </span>
        </div>

        {/* Game Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Created:</span>
            <span className="text-gray-900 font-medium">{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Teams:</span>
            <span className="text-gray-900 font-medium">{game.num_teams}</span>
          </div>
          {game.timer_enabled && (
            <div className="flex justify-between">
              <span className="text-gray-500">Timer:</span>
              <span className="text-gray-900 font-medium">
                {game.timer_seconds}s per question
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Launch Button */}
      <div className="px-4 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
        <button
          onClick={onLaunch}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium text-sm"
        >
          Launch Game
        </button>
      </div>
    </div>
  );
}
