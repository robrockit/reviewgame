import React, { useState, useCallback } from 'react';
import useSound from 'use-sound';
import { logger } from '@/lib/logger';

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

  // Function to play sounds based on event with optional configuration
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
