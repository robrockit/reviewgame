'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

/**
 * Timer Props Interface
 */
export interface TimerProps {
  /** Total duration in seconds */
  duration: number;
  /** Whether the timer is enabled */
  enabled: boolean;
  /** Callback when timer reaches 0 */
  onExpire?: () => void;
  /** Optional callback each second with remaining time */
  onTick?: (remaining: number) => void;
  /** Auto-start timer on mount (default: true) */
  autoStart?: boolean;
}

/**
 * Get color based on remaining time
 */
const getTimerColor = (remaining: number): string => {
  if (remaining <= 0) return 'text-red-600'; // Expired
  if (remaining < 1) return 'text-red-500'; // Critical (<1s)
  if (remaining <= 3) return 'text-yellow-500'; // Warning (1-3s)
  return 'text-green-500'; // Normal (>3s)
};

/**
 * Get background color based on remaining time
 */
const getTimerBgColor = (remaining: number): string => {
  if (remaining <= 0) return 'bg-red-100'; // Expired
  if (remaining < 1) return 'bg-red-50'; // Critical
  if (remaining <= 3) return 'bg-yellow-50'; // Warning
  return 'bg-green-50'; // Normal
};

/**
 * Get progress stroke color based on remaining time
 */
const getProgressColor = (remaining: number): string => {
  if (remaining <= 0) return '#DC2626'; // Red-600
  if (remaining < 1) return '#EF4444'; // Red-500
  if (remaining <= 3) return '#EAB308'; // Yellow-500
  return '#10B981'; // Green-500
};

/**
 * Timer Component
 *
 * Displays a visual countdown with circular progress indicator.
 * Implements Phase 6, Section 6.4 & 6.10 requirements.
 *
 * Features:
 * - Circular progress indicator with countdown number
 * - Color-coded urgency (green → yellow → red)
 * - Smooth animations
 * - Accessibility support with ARIA live regions
 * - Auto-start capability
 * - Expiration callback
 *
 * @param duration - Total seconds for countdown
 * @param enabled - Whether timer is enabled
 * @param onExpire - Callback when timer reaches 0
 * @param onTick - Optional callback each second
 * @param autoStart - Auto-start on mount (default: true)
 */
export const Timer: React.FC<TimerProps> = ({
  duration,
  enabled,
  onExpire,
  onTick,
  autoStart = true,
}) => {
  const [remainingTime, setRemainingTime] = useState(duration);
  const [isExpired, setIsExpired] = useState(false);
  const [isPaused, setIsPaused] = useState(!autoStart);

  // Use refs to avoid stale closures in interval
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);

  // Update refs when callbacks change
  useEffect(() => {
    onExpireRef.current = onExpire;
    onTickRef.current = onTick;
  }, [onExpire, onTick]);

  // Reset timer when duration changes
  useEffect(() => {
    setRemainingTime(duration);
    setIsExpired(false);
    if (autoStart) {
      setIsPaused(false);
    }
  }, [duration, autoStart]);

  // Countdown logic - Fixed to prevent memory leaks
  useEffect(() => {
    // Always set up interval, cleanup handles disabled state
    const interval = setInterval(() => {
      // Only countdown if enabled and not paused/expired
      if (!enabled || isPaused || isExpired) return;

      setRemainingTime((prev) => {
        const newTime = prev - 1;

        if (newTime <= 0) {
          setIsExpired(true);
          onExpireRef.current?.();
          return 0;
        }

        onTickRef.current?.(newTime);
        return newTime;
      });
    }, 1000); // Update every second

    // Always cleanup interval
    return () => clearInterval(interval);
  }, [enabled, isPaused, isExpired]); // Removed onExpire, onTick from deps

  // Defensive validation - check AFTER all hooks are called
  if (duration <= 0) {
    logger.error('Timer duration must be positive', {
      duration,
      component: 'Timer',
      operation: 'validate'
    });
    return null;
  }

  // Don't render if not enabled
  if (!enabled) return null;

  // Calculate progress percentage (safe division)
  const progress = duration > 0 ? (remainingTime / duration) * 100 : 0;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Get colors based on remaining time
  const textColor = getTimerColor(remainingTime);
  const bgColor = getTimerBgColor(remainingTime);
  const strokeColor = getProgressColor(remainingTime);

  // ARIA announcements at key intervals
  const getAriaLabel = () => {
    if (isExpired) return "Time&apos;s up";
    if (remainingTime === 10) return "10 seconds remaining";
    if (remainingTime === 5) return "5 seconds remaining";
    if (remainingTime === 3) return "3 seconds remaining";
    if (remainingTime === 1) return "1 second remaining";
    return `${remainingTime} seconds remaining`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circular Timer */}
      <div className={`relative ${bgColor} rounded-full p-4 transition-colors duration-300 ${
        isExpired ? 'animate-pulse' : ''
      }`}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Timer number in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-5xl font-bold ${textColor} transition-colors duration-300`}
            role="timer"
            aria-live="polite"
            aria-atomic="true"
            aria-label={getAriaLabel()}
          >
            {remainingTime}
          </span>
        </div>
      </div>

      {/* Time's Up Message */}
      {isExpired && (
        <div className="text-center">
          <p className="text-red-600 font-bold text-lg animate-pulse">
            TIME&apos;S UP!
          </p>
        </div>
      )}

      {/* Seconds label */}
      {!isExpired && (
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium">
            {remainingTime === 1 ? 'second' : 'seconds'}
          </p>
        </div>
      )}
    </div>
  );
};
