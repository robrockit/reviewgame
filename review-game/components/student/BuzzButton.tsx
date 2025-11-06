'use client';

import { useState, useRef, useEffect } from 'react';
import useSound from 'use-sound';
import { getPositionDisplay } from '@/lib/utils/position';

/**
 * Button state determines visual appearance and behavior
 */
export type BuzzButtonState = 'active' | 'buzzed' | 'answering' | 'waiting';

interface BuzzButtonProps {
  /** Current state of the button */
  state: BuzzButtonState;
  /** Callback when button is pressed */
  onBuzz: () => void;
  /** Optional: Override button size (default: 250px) */
  size?: number;
  /** Optional: Disable sound effects */
  disableSound?: boolean;
  /** Optional: Disable haptic feedback */
  disableHaptic?: boolean;
  /** Optional: Position in buzz queue (1 = first, 2 = second, etc.) */
  queuePosition?: number | null;
}

/**
 * Large Buzz Button Component
 *
 * Touch-friendly button for students to buzz in during game play.
 * Implements specifications from Phase 8, Section 8.4.
 *
 * Features:
 * - Four visual states (active, buzzed, answering, waiting)
 * - Sound effects on press
 * - Haptic feedback on mobile devices
 * - Large touch target (250×250px minimum)
 * - High contrast colors for accessibility
 * - Pulsing animation for answering state
 *
 * @param state - Current button state
 * @param onBuzz - Callback function when button is pressed
 * @param size - Button diameter in pixels (default: 250)
 * @param disableSound - Disable sound effects
 * @param disableHaptic - Disable haptic feedback
 */
export const BuzzButton: React.FC<BuzzButtonProps> = ({
  state,
  onBuzz,
  size = 250,
  disableSound = false,
  disableHaptic = false,
  queuePosition = null,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load buzz sound effect
  // Note: Sound file should be placed at public/sounds/buzz.mp3
  const [playBuzz] = useSound('/sounds/buzz.mp3', {
    volume: 0.5,
    soundEnabled: !disableSound,
  });

  // Cleanup timeout on unmount or state change
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  /**
   * Triggers haptic feedback if available (mobile devices)
   * Uses the Vibration API with a short pulse
   * Includes proper type casting and error handling
   */
  const triggerHaptic = () => {
    if (disableHaptic) return;

    // Check if Vibration API is available
    if (
      typeof window !== 'undefined' &&
      window.navigator &&
      'vibrate' in window.navigator
    ) {
      try {
        // Type cast to support vibrate API
        const nav = window.navigator as Navigator & {
          vibrate: (pattern: number | number[]) => boolean;
        };
        // Short vibration pulse (50ms)
        // Returns true if successful, false if not supported
        nav.vibrate(50);
      } catch (error) {
        // Silently fail if vibration is not supported
        // This is expected on many desktop browsers
        console.debug('Haptic feedback not supported:', error);
      }
    }
  };

  /**
   * Handles button press
   * - Plays sound effect
   * - Triggers haptic feedback
   * - Calls onBuzz callback
   * - Provides visual feedback with proper cleanup
   */
  const handlePress = () => {
    // Only allow press when active
    if (state !== 'active') return;

    // Clear any existing timer to prevent race conditions
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }

    // Visual feedback
    setIsPressed(true);
    pressTimerRef.current = setTimeout(() => {
      setIsPressed(false);
      pressTimerRef.current = null;
    }, 200);

    // Sound effect
    playBuzz();

    // Haptic feedback
    triggerHaptic();

    // Callback
    onBuzz();
  };

  /**
   * Handles keyboard events for accessibility
   * Supports Space and Enter keys
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Only handle Space and Enter when button is active
    if (state !== 'active') return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); // Prevent default scrolling on Space
      handlePress();
    }
  };

  /**
   * Get button styling based on current state
   */
  const getButtonStyle = () => {
    const baseStyle = `
      rounded-full
      flex items-center justify-center
      font-bold text-white
      transition-all duration-200
      select-none
      cursor-pointer
      ${isPressed ? 'scale-95' : 'scale-100'}
    `;

    switch (state) {
      case 'active':
        return `${baseStyle} bg-red-600 hover:bg-red-700 active:scale-95 shadow-2xl hover:shadow-red-500/50`;

      case 'buzzed':
        return `${baseStyle} bg-yellow-400 text-blue-900 cursor-not-allowed opacity-90`;

      case 'answering':
        return `${baseStyle} bg-green-500 animate-pulse shadow-2xl shadow-green-500/50`;

      case 'waiting':
        return `${baseStyle} bg-gray-400 text-gray-700 cursor-not-allowed opacity-75`;

      default:
        return baseStyle;
    }
  };

  /**
   * Get button text based on current state
   */
  const getButtonText = () => {
    switch (state) {
      case 'active':
        return 'BUZZ!';
      case 'buzzed':
        return 'BUZZED';
      case 'answering':
        return 'ANSWER!';
      case 'waiting':
        return 'WAIT';
      default:
        return 'BUZZ!';
    }
  };

  /**
   * Get text size based on button size
   */
  const getTextSize = () => {
    if (size >= 300) return 'text-6xl';
    if (size >= 250) return 'text-5xl';
    if (size >= 200) return 'text-4xl';
    return 'text-3xl';
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handlePress}
        onKeyDown={handleKeyDown}
        disabled={state !== 'active'}
        className={getButtonStyle()}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
        }}
        aria-label={`Buzz button - ${state}`}
        aria-pressed={state === 'buzzed'}
        aria-disabled={state !== 'active'}
        type="button"
      >
        <span className={getTextSize()}>{getButtonText()}</span>
      </button>

      {/* Status indicator text */}
      <div className="text-center">
        <p className="text-sm text-gray-600 font-medium">
          {state === 'active' && (
            <>
              <span aria-hidden="true">🎯 </span>
              <span>Ready to buzz in</span>
            </>
          )}
          {state === 'buzzed' && queuePosition && (
            <>
              <span aria-hidden="true">{getPositionDisplay(queuePosition - 1).emoji} </span>
              <span>Position: {getPositionDisplay(queuePosition - 1).text}</span>
            </>
          )}
          {state === 'buzzed' && !queuePosition && (
            <>
              <span aria-hidden="true">⏳ </span>
              <span>You buzzed in!</span>
            </>
          )}
          {state === 'answering' && (
            <>
              <span aria-hidden="true">✨ </span>
              <span>Your turn to answer!</span>
            </>
          )}
          {state === 'waiting' && (
            <>
              <span aria-hidden="true">💤 </span>
              <span>Waiting for question...</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
