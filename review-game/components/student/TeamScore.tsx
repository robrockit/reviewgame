"use client";

import React, { useState, useEffect, useRef } from 'react';
import { SCORE_ANIMATION_DURATION } from '../../lib/constants/animations';
import { useAnimatedScore } from '../../lib/hooks/useAnimatedScore';

interface TeamScoreProps {
  teamName: string;
  currentScore: number;
  teamColor?: string;
}

/**
 * TeamScore Component - Student-facing score display
 *
 * Displays the student's team score with:
 * - Animated score changes (count-up/down effect)
 * - Visual feedback (green flash for gains, red for losses)
 * - Large, prominent display for classroom visibility
 * - Support for negative scores
 */
export const TeamScore: React.FC<TeamScoreProps> = ({
  teamName,
  currentScore,
  teamColor = '#3b82f6' // Default blue
}) => {
  const displayScore = useAnimatedScore(currentScore);
  const [flashClass, setFlashClass] = useState('');
  const [scoreChangeAmount, setScoreChangeAmount] = useState<number | null>(null);
  const prevScoreRef = useRef(currentScore);
  const flashTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Detect score changes and trigger flash effect
  useEffect(() => {
    if (prevScoreRef.current !== currentScore) {
      const scoreChange = currentScore - prevScoreRef.current;

      // Clear any existing flash timer to prevent overlapping animations
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }

      // Set the score change amount for display
      setScoreChangeAmount(scoreChange);

      // Trigger appropriate flash effect
      if (scoreChange > 0) {
        setFlashClass('animate-flash-green');
      } else if (scoreChange < 0) {
        setFlashClass('animate-flash-red');
      }

      // Update prevScoreRef immediately after detecting change
      prevScoreRef.current = currentScore;

      // Remove flash class and score change indicator after animation
      flashTimerRef.current = setTimeout(() => {
        setFlashClass('');
        setScoreChangeAmount(null);
      }, SCORE_ANIMATION_DURATION);

      return () => {
        if (flashTimerRef.current) {
          clearTimeout(flashTimerRef.current);
        }
      };
    }
  }, [currentScore]);

  return (
    <div className={`team-score-display p-6 rounded-xl shadow-2xl ${flashClass}`}
         style={{
           background: `linear-gradient(135deg, ${teamColor}dd, ${teamColor}99)`,
           border: `3px solid ${teamColor}`,
         }}>
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          {teamName}
        </h2>
        <div className="score-container bg-black bg-opacity-30 rounded-lg p-6 mb-3">
          <div className={`text-6xl md:text-8xl font-extrabold ${
            currentScore < 0 ? 'text-red-300' : 'text-white'
          }`}>
            {displayScore}
          </div>
          <div className="text-lg md:text-xl text-white opacity-75 mt-2">
            points
          </div>
        </div>

        {/* Score change indicator */}
        {scoreChangeAmount !== null && (
          <div className={`text-sm font-semibold ${
            scoreChangeAmount > 0
              ? 'text-green-300'
              : 'text-red-300'
          }`}>
            {scoreChangeAmount > 0 ? '+' : ''}
            {scoreChangeAmount}
          </div>
        )}
      </div>
    </div>
  );
};
