"use client";

import React, { useState, useEffect, useRef } from 'react';

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
  const [displayScore, setDisplayScore] = useState(currentScore);
  const [flashClass, setFlashClass] = useState('');
  const prevScoreRef = useRef(currentScore);
  const animationRef = useRef<number | undefined>(undefined);

  // Animate score changes
  useEffect(() => {
    if (displayScore !== currentScore) {
      const startScore = displayScore;
      const startTime = Date.now();
      const duration = 500; // Animation duration in ms

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuad = (t: number) => t * (2 - t);
        const easedProgress = easeOutQuad(progress);

        const current = Math.round(
          startScore + (currentScore - startScore) * easedProgress
        );
        setDisplayScore(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [currentScore, displayScore]);

  // Detect score changes and trigger flash effect
  useEffect(() => {
    if (prevScoreRef.current !== currentScore) {
      const scoreChange = currentScore - prevScoreRef.current;

      // Trigger appropriate flash effect
      if (scoreChange > 0) {
        setFlashClass('animate-flash-green');
      } else if (scoreChange < 0) {
        setFlashClass('animate-flash-red');
      }

      // Remove flash class after animation
      const timer = setTimeout(() => setFlashClass(''), 600);
      prevScoreRef.current = currentScore;

      return () => clearTimeout(timer);
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
        {prevScoreRef.current !== currentScore && (
          <div className={`text-sm font-semibold ${
            currentScore - prevScoreRef.current > 0
              ? 'text-green-300'
              : 'text-red-300'
          }`}>
            {currentScore - prevScoreRef.current > 0 ? '+' : ''}
            {currentScore - prevScoreRef.current}
          </div>
        )}
      </div>
    </div>
  );
};
