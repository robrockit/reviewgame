'use client';

import type { GameListItem } from '@/types/game.types';
import GameCard from './GameCard';
import EmptyGamesState from './EmptyGamesState';

interface GameListViewProps {
  games: GameListItem[];
  onLaunch: (gameId: string) => void;
  onEdit: (gameId: string) => void;
  onDuplicate: (gameId: string) => void;
  onShare: (gameId: string) => void;
  onDelete: (gameId: string) => void;
  hasSearch: boolean;
}

export default function GameListView({
  games,
  onLaunch,
  onEdit,
  onDuplicate,
  onShare,
  onDelete,
  hasSearch,
}: GameListViewProps) {
  if (games.length === 0) {
    return <EmptyGamesState hasSearch={hasSearch} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onLaunch={() => onLaunch(game.id)}
          onEdit={() => onEdit(game.id)}
          onDuplicate={() => onDuplicate(game.id)}
          onShare={() => onShare(game.id)}
          onDelete={() => onDelete(game.id)}
        />
      ))}
    </div>
  );
}
