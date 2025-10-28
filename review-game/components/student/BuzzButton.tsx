'use client';

import { useState } from 'react';
import useSound from 'use-sound';

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
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // Load buzz sound effect
  // Note: Sound file should be placed at public/sounds/buzz.mp3
  const [playBuzz] = useSound('/sounds/buzz.mp3', {
    volume: 0.5,
    soundEnabled: !disableSound,
  });

  /**
   * Triggers haptic feedback if available (mobile devices)
   * Uses the Vibration API with a short pulse
   */
  const triggerHaptic = () => {
    if (disableHaptic) return;

    // Check if Vibration API is available
    if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
      // Short vibration pulse (50ms)
      window.navigator.vibrate(50);
    }
  };

  /**
   * Handles button press
   * - Plays sound effect
   * - Triggers haptic feedback
   * - Calls onBuzz callback
   * - Provides visual feedback
   */
  const handlePress = () => {
    // Only allow press when active
    if (state !== 'active') return;

    // Visual feedback
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);

    // Sound effect
    playBuzz();

    // Haptic feedback
    triggerHaptic();

    // Callback
    onBuzz();
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
          {state === 'active' && '🎯 Ready to buzz in'}
          {state === 'buzzed' && '⏳ You buzzed in!'}
          {state === 'answering' && '✨ Your turn to answer!'}
          {state === 'waiting' && '💤 Waiting for question...'}
        </p>
      </div>
    </div>
  );
};
