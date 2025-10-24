import { useState, useCallback } from 'react';
import useSound from 'use-sound';

// Define sound event types for type safety
export type SoundEvent =
  | 'buzz'
  | 'correct'
  | 'incorrect'
  | 'dailyDouble'
  | 'finalJeopardy'
  | 'timerTick';

// Sound configuration options
export interface SoundOptions {
  volume?: number; // 0.0 to 1.0
  playbackRate?: number; // Speed multiplier
  interrupt?: boolean; // Whether to interrupt currently playing sound
}

// Hook return type
export interface SoundEffectsHook {
  playSound: (event: SoundEvent, options?: SoundOptions) => void;
  setGlobalVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  globalVolume: number;
}

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
  const [playBuzzSound] = useSound(soundPaths.buzz, {
    volume: isMuted ? 0 : globalVolume,
    interrupt: true
  });

  const [playCorrectSound] = useSound(soundPaths.correct, {
    volume: isMuted ? 0 : globalVolume,
    interrupt: true
  });

  const [playIncorrectSound] = useSound(soundPaths.incorrect, {
    volume: isMuted ? 0 : globalVolume,
    interrupt: true
  });

  const [playDailyDoubleSound] = useSound(soundPaths.dailyDouble, {
    volume: isMuted ? 0 : globalVolume * 0.8, // Slightly quieter for dramatic effect
    interrupt: true
  });

  const [playFinalJeopardySound] = useSound(soundPaths.finalJeopardy, {
    volume: isMuted ? 0 : globalVolume * 0.6, // Quieter for background music
    interrupt: false // Don't interrupt this one
  });

  const [playTimerSound, { stop: stopTimer }] = useSound(soundPaths.timerTick, {
    volume: isMuted ? 0 : globalVolume * 0.5, // Quieter for timer
    loop: true // Timer should loop
  });

  // Function to play sounds based on event with optional configuration
  const playSound = useCallback((event: SoundEvent, options?: SoundOptions) => {
    if (isMuted && !options?.volume) {
      return; // Don't play if muted unless explicit volume override
    }

    const effectiveVolume = options?.volume !== undefined
      ? options.volume
      : globalVolume;

    switch (event) {
      case 'buzz':
        playBuzzSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'correct':
        playCorrectSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'incorrect':
        playIncorrectSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'dailyDouble':
        playDailyDoubleSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'finalJeopardy':
        playFinalJeopardySound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      case 'timerTick':
        playTimerSound({
          playbackRate: options?.playbackRate || 1.0
        });
        break;

      default:
        console.warn(`Unknown sound event: ${event}`);
    }
  }, [
    isMuted,
    globalVolume,
    playBuzzSound,
    playCorrectSound,
    playIncorrectSound,
    playDailyDoubleSound,
    playFinalJeopardySound,
    playTimerSound
  ]);

  // Mute/unmute functions
  const mute = useCallback(() => {
    setIsMuted(true);
    stopTimer(); // Stop timer if playing
  }, [stopTimer]);

  const unmute = useCallback(() => {
    setIsMuted(false);
  }, []);

  // Set global volume (0.0 to 1.0)
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
