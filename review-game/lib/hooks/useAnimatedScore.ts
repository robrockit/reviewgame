import { useState, useEffect, useRef } from 'react';
import { SCORE_ANIMATION_DURATION, easeOutQuad } from '../constants/animations';

/**
 * Hook to animate score changes with smooth count-up/down effect
 *
 * Features:
 * - Prevents memory leaks by using refs for closure values
 * - Cancels previous animations before starting new ones
 * - Uses easeOutQuad easing for natural motion
 *
 * @param targetScore - The target score to animate to
 * @param duration - Animation duration in milliseconds (default: SCORE_ANIMATION_DURATION)
 * @returns The current animated score value
 */
export const useAnimatedScore = (
  targetScore: number,
  duration: number = SCORE_ANIMATION_DURATION
): number => {
  const [displayScore, setDisplayScore] = useState(targetScore);
  const animationRef = useRef<number | undefined>(undefined);
  const previousTargetRef = useRef(targetScore);
  // Use ref to track the start score to prevent stale closures
  const startScoreRef = useRef(targetScore);

  useEffect(() => {
    // Only animate if target actually changed
    if (previousTargetRef.current === targetScore) return;

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Store the start score in ref to avoid stale closure
    startScoreRef.current = displayScore;
    const startTime = Date.now();

    // Update target ref immediately
    previousTargetRef.current = targetScore;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);

      const current = Math.round(
        startScoreRef.current + (targetScore - startScoreRef.current) * easedProgress
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
  }, [targetScore, duration]);

  return displayScore;
};
