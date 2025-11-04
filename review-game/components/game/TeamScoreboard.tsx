import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import type { Team } from '../../types/game';
import { SCORE_ANIMATION_DURATION } from '../../lib/constants/animations';
import { useAnimatedScore } from '../../lib/hooks/useAnimatedScore';

// Individual team card component with animations
interface TeamCardProps {
  team: Team;
  index: number;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, index }) => {
  const animatedScore = useAnimatedScore(team.score);
  const [flashClass, setFlashClass] = useState('');
  const prevScoreRef = useRef(team.score);
  const flashTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Detect score changes and trigger flash effect
  useEffect(() => {
    if (prevScoreRef.current !== team.score) {
      const scoreChange = team.score - prevScoreRef.current;

      // Clear any existing flash timer to prevent overlapping animations
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }

      // Determine flash color based on positive/negative change
      if (scoreChange > 0) {
        setFlashClass('animate-flash-green');
      } else if (scoreChange < 0) {
        setFlashClass('animate-flash-red');
      }

      // Update prevScoreRef immediately after detecting change
      prevScoreRef.current = team.score;

      // Remove flash class after animation completes
      flashTimerRef.current = setTimeout(() => setFlashClass(''), SCORE_ANIMATION_DURATION);
    }

    // Cleanup should ALWAYS be returned to prevent memory leaks
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, [team.score]);

  // Determine rank styling
  const getRankStyle = () => {
    if (index === 0) {
      return 'bg-gradient-to-br from-yellow-500 to-yellow-600 border-2 border-yellow-300';
    } else if (index === 1) {
      return 'bg-gradient-to-br from-gray-400 to-gray-500 border-2 border-gray-300';
    } else if (index === 2) {
      return 'bg-gradient-to-br from-orange-600 to-orange-700 border-2 border-orange-400';
    }
    return 'bg-gray-700 border-2 border-gray-600';
  };

  return (
    <div
      className={`team-card p-4 rounded-lg shadow-lg transition-all ${getRankStyle()} ${flashClass}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold opacity-80">
          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
        </span>
        {index < 3 && (
          <span className="text-xs bg-black bg-opacity-20 px-2 py-1 rounded">
            {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
          </span>
        )}
      </div>
      <div className="text-center">
        <h3 className="font-bold text-lg mb-1">{team.name}</h3>
        <div className={`text-3xl font-bold ${team.score < 0 ? 'text-red-300' : ''}`}>
          {animatedScore}
        </div>
        <div className="text-xs opacity-75 mt-1">points</div>
      </div>
    </div>
  );
};

export const TeamScoreboard: React.FC = () => {
  const { allTeams } = useGameStore();

  // Sort teams by score (descending) for leaderboard view
  const sortedTeams = [...allTeams].sort((a, b) => b.score - a.score);

  if (allTeams.length === 0) {
    return (
      <div className="team-scoreboard p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-center">No teams connected yet...</p>
      </div>
    );
  }

  return (
    <div className="team-scoreboard bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-white">Scoreboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedTeams.map((team, index) => (
          <TeamCard key={team.id} team={team} index={index} />
        ))}
      </div>

      {/* Total stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex justify-around text-sm text-gray-300">
          <div className="text-center">
            <div className="font-semibold text-white">{allTeams.length}</div>
            <div className="text-xs">Teams</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-white">
              {allTeams.reduce((sum, team) => sum + team.score, 0)}
            </div>
            <div className="text-xs">Total Points</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-white">
              {allTeams.length > 0
                ? Math.round(allTeams.reduce((sum, team) => sum + team.score, 0) / allTeams.length)
                : 0}
            </div>
            <div className="text-xs">Avg. Score</div>
          </div>
        </div>
      </div>
    </div>
  );
};
