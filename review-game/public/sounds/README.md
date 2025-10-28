# Sound Effects

This directory contains sound effects for the Review Game application.

## Required Sound Files

### buzz.mp3
**Used by:** BuzzButton component (`components/student/BuzzButton.tsx`)
**Description:** Sound effect played when students buzz in to answer a question
**Specifications:**
- Format: MP3
- Duration: 0.5-1 second (short and punchy)
- Volume: Moderate (component uses 0.5 volume multiplier)
- Type: Buzzer or bell sound

**Sources for Free Sound Effects:**
- [Freesound.org](https://freesound.org) - Search for "buzzer" or "bell"
- [Zapsplat.com](https://www.zapsplat.com) - Game sound effects
- [Mixkit.co](https://mixkit.co/free-sound-effects/) - Free game sounds

**Example searches:**
- "game show buzzer"
- "quiz buzzer"
- "bell ding"

## Additional Sound Files (Phase 6)

According to Phase 6 specifications, these additional sounds will be needed:

### correct.mp3
- Correct answer chime

### incorrect.mp3
- Incorrect answer buzz

### daily-double.mp3
- Daily Double reveal sound

### final-jeopardy.mp3
- Final Jeopardy theme

### timer.mp3
- Timer tick sound

## Installation

1. Download or create the sound files
2. Place them in this directory (`public/sounds/`)
3. Ensure file names match exactly (case-sensitive)
4. Test in the application

## Testing

Test the buzz sound at: http://localhost:3000/test-buzz

## License Note

Ensure all sound effects are licensed for commercial use or are royalty-free before deployment.
