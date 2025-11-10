/**
 * @fileoverview Hook for managing game sound effects with volume control.
 *
 * This hook provides a centralized interface for playing various game sounds
 * including buzzes, correct/incorrect feedback, Daily Double announcements,
 * Final Jeopardy music, and timer ticks. It supports global volume control,
 * muting, and per-sound volume adjustments.
 *
 * The hook uses the 'use-sound' library (which wraps Howler.js) for reliable
 * audio playback across different browsers.
 *
 * @module hooks/useSoundEffects
 */

import React, { useState, useCallback } from 'react';
import useSound from 'use-sound';
import { logger } from '@/lib/logger';

/**
 * Available sound event types for the game.
 *
 * @typedef {('buzz' | 'correct' | 'incorrect' | 'dailyDouble' | 'finalJeopardy' | 'timerTick')} SoundEvent
 */
export type SoundEvent =
  | 'buzz'
  | 'correct'
  | 'incorrect'
  | 'dailyDouble'
  | 'finalJeopardy'
  | 'timerTick';

/**
 * Configuration options for playing a sound.
 *
 * @interface SoundOptions
 * @property {number} [volume] - Volume level from 0.0 (silent) to 1.0 (full volume)
 * @property {number} [playbackRate] - Playback speed multiplier (1.0 is normal speed)
 * @property {boolean} [interrupt] - Whether to interrupt the currently playing sound
 */
export interface SoundOptions {
  volume?: number;
  playbackRate?: number;
  interrupt?: boolean;
}

/**
 * Return type of the useSoundEffects hook.
 *
 * @interface SoundEffectsHook
 * @property {function} playSound - Function to play a specific sound effect
 * @property {function} setGlobalVolume - Function to set the global volume level
 * @property {function} mute - Function to mute all sounds
 * @property {function} unmute - Function to unmute all sounds
 * @property {boolean} isMuted - Current mute state
 * @property {number} globalVolume - Current global volume level (0.0 to 1.0)
 */
export interface SoundEffectsHook {
  playSound: (event: SoundEvent, options?: SoundOptions) => void;
  setGlobalVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  globalVolume: number;
}

/**
 * Custom hook for managing game sound effects.
 *
 * This hook provides:
 * - Sound playback for various game events (buzz, correct, incorrect, etc.)
 * - Global volume control that affects all sounds
 * - Mute/unmute functionality
 * - Per-sound volume adjustments
 * - Automatic volume synchronization across all loaded sounds
 *
 * Each sound has a default volume multiplier that balances audio levels:
 * - Buzz, correct, incorrect: 100% of global volume
 * - Daily Double: 80% of global volume
 * - Final Jeopardy: 60% of global volume (background music)
 * - Timer: 50% of global volume
 *
 * @returns {SoundEffectsHook} Object containing sound control functions and state
 *
 * @example
 * ```tsx
 * const { playSound, setGlobalVolume, mute, unmute } = useSoundEffects();
 *
 * // Play a buzz sound
 * playSound('buzz');
 *
 * // Play with custom options
 * playSound('correct', { volume: 0.8, playbackRate: 1.2 });
 *
 * // Control global volume
 * setGlobalVolume(0.5); // 50% volume
 * mute(); // Mute all sounds
 * unmute(); // Restore volume
 * ```
 */
const useSoundEffects = (): SoundEffectsHook => {
  // Global volume state (0.0 to 1.0)
  const [globalVolume, setGlobalVolume] = useState<number>(0.7); // Default to 70%
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Define sound paths
  const soundPaths = {
    buzz: '/sounds/buzz.mp3',
    correct: '/sounds/correct.mp3',
    incorrect: '/sounds/incorrect.mp3',
    dailyDouble: '/sounds/daily-double.mp3',
    finalJeopardy: '/sounds/final-jeopardy.mp3',
    timerTick: '/sounds/timer.mp3',
  };

  // Load sounds using useSound hook with volume control
  // The second element of the returned array contains the Howl instance we can use to update volume
  const [playBuzzSound, buzzControls] = useSound(soundPaths.buzz, {
    volume: isMuted ? 0 : globalVolume * 1.0,
    interrupt: true
  });

  const [playCorrectSound, correctControls] = useSound(soundPaths.correct, {
    volume: isMuted ? 0 : globalVolume * 1.0,
    interrupt: true
  });

  const [playIncorrectSound, incorrectControls] = useSound(soundPaths.incorrect, {
    volume: isMuted ? 0 : globalVolume * 1.0,
    interrupt: true
  });

  const [playDailyDoubleSound, dailyDoubleControls] = useSound(soundPaths.dailyDouble, {
    volume: isMuted ? 0 : globalVolume * 0.8, // Slightly quieter for dramatic effect
    interrupt: true
  });

  const [playFinalJeopardySound, finalJeopardyControls] = useSound(soundPaths.finalJeopardy, {
    volume: isMuted ? 0 : globalVolume * 0.6, // Quieter for background music
    interrupt: false // Don't interrupt this one
  });

  const [playTimerSound, timerControls] = useSound(soundPaths.timerTick, {
    volume: isMuted ? 0 : globalVolume * 0.5, // Quieter for timer
    loop: true // Timer should loop
  });

  const { stop: stopTimer } = timerControls;

  // Update volume on all sound instances when globalVolume or isMuted changes
  // This fixes the stale closure bug by directly manipulating the Howl instances
  React.useEffect(() => {
    const sounds = [
      { controls: buzzControls, multiplier: 1.0 },
      { controls: correctControls, multiplier: 1.0 },
      { controls: incorrectControls, multiplier: 1.0 },
      { controls: dailyDoubleControls, multiplier: 0.8 },
      { controls: finalJeopardyControls, multiplier: 0.6 },
      { controls: timerControls, multiplier: 0.5 }
    ];

    sounds.forEach(({ controls, multiplier }) => {
      if (controls.sound) {
        const effectiveVolume = isMuted ? 0 : globalVolume * multiplier;
        controls.sound.volume(effectiveVolume);
      }
    });
  }, [globalVolume, isMuted, buzzControls, correctControls, incorrectControls,
      dailyDoubleControls, finalJeopardyControls, timerControls]);

  /**
   * Plays a sound effect based on the specified event type.
   *
   * This function plays the appropriate sound for the given event type and
   * applies any custom options provided. If a custom volume is specified,
   * it temporarily overrides the global volume for that specific sound play.
   *
   * @param {SoundEvent} event - The type of sound to play
   * @param {SoundOptions} [options] - Optional playback configuration
   * @param {number} [options.volume] - Custom volume for this play (0.0 to 1.0)
   * @param {number} [options.playbackRate] - Playback speed multiplier (default: 1.0)
   *
   * @example
   * ```tsx
   * // Play buzz at default volume
   * playSound('buzz');
   *
   * // Play correct sound at half volume, 1.5x speed
   * playSound('correct', { volume: 0.5, playbackRate: 1.5 });
   * ```
   */
  const playSound = useCallback((event: SoundEvent, options?: SoundOptions) => {
    // If custom volume is provided, temporarily set it on the appropriate sound instance
    // Otherwise, the volume set by the useEffect will be used

    switch (event) {
      case 'buzz':
        if (options?.volume !== undefined && buzzControls.sound) {
          buzzControls.sound.volume(options.volume);
        }
        playBuzzSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'correct':
        if (options?.volume !== undefined && correctControls.sound) {
          correctControls.sound.volume(options.volume);
        }
        playCorrectSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'incorrect':
        if (options?.volume !== undefined && incorrectControls.sound) {
          incorrectControls.sound.volume(options.volume);
        }
        playIncorrectSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'dailyDouble':
        if (options?.volume !== undefined && dailyDoubleControls.sound) {
          dailyDoubleControls.sound.volume(options.volume * 0.8);
        }
        playDailyDoubleSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'finalJeopardy':
        if (options?.volume !== undefined && finalJeopardyControls.sound) {
          finalJeopardyControls.sound.volume(options.volume * 0.6);
        }
        playFinalJeopardySound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'timerTick':
        if (options?.volume !== undefined && timerControls.sound) {
          timerControls.sound.volume(options.volume * 0.5);
        }
        playTimerSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      default:
        logger.warn('Unknown sound event requested', {
          event,
          operation: 'playSound',
          hook: 'useSoundEffects'
        });
    }
  }, [
    playBuzzSound,
    playCorrectSound,
    playIncorrectSound,
    playDailyDoubleSound,
    playFinalJeopardySound,
    playTimerSound,
    buzzControls,
    correctControls,
    incorrectControls,
    dailyDoubleControls,
    finalJeopardyControls,
    timerControls
  ]);

  /**
   * Mutes all sound effects.
   *
   * Sets the volume to 0 for all currently loaded sounds and stops the timer
   * sound if it's currently playing. The globalVolume setting is preserved
   * and will be restored when unmute() is called.
   *
   * @example
   * ```tsx
   * mute(); // All sounds muted
   * ```
   */
  const mute = useCallback(() => {
    setIsMuted(true);
    stopTimer(); // Stop timer if playing
  }, [stopTimer]);

  /**
   * Unmutes all sound effects.
   *
   * Restores the volume to the current globalVolume setting for all sounds.
   *
   * @example
   * ```tsx
   * unmute(); // Sounds restored to previous volume
   * ```
   */
  const unmute = useCallback(() => {
    setIsMuted(false);
  }, []);

  /**
   * Sets the global volume level for all sound effects.
   *
   * This affects all sounds with their respective multipliers. For example,
   * if you set the global volume to 0.5, the buzz sound will play at 50%
   * volume, while the timer will play at 25% (50% of the 0.5 multiplier).
   *
   * The volume is automatically clamped between 0.0 and 1.0.
   *
   * @param {number} volume - Volume level from 0.0 (silent) to 1.0 (full volume)
   *
   * @example
   * ```tsx
   * setGlobalVolume(0.7); // Set to 70% volume
   * setGlobalVolume(1.5); // Clamped to 1.0 (100%)
   * setGlobalVolume(-0.2); // Clamped to 0.0 (silent)
   * ```
   */
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setGlobalVolume(clampedVolume);
  }, []);

  return {
    playSound,
    setGlobalVolume: setVolume,
    mute,
    unmute,
    isMuted,
    globalVolume,
  };
};

export default useSoundEffects;
