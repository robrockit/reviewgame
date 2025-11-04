/**
 * Animation constants for consistent timing across the application
 *
 * These values should match corresponding CSS animation durations
 * to ensure visual consistency between JS and CSS animations.
 */

// Score animation durations
export const SCORE_ANIMATION_DURATION = 600; // ms - matches CSS flash animations
export const FLASH_EFFECT_DURATION = 600; // ms - matches CSS keyframes

// Easing function for score animations
export const easeOutQuad = (t: number): number => t * (2 - t);
