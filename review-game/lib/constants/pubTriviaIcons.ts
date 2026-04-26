export interface PubTriviaIcon {
  emoji: string;
  label: string;
  category: 'animals' | 'sports' | 'vehicles' | 'science' | 'music';
}

export const PUB_TRIVIA_ICONS: PubTriviaIcon[] = [
  // Animals
  { emoji: '🐶', label: 'Dog',      category: 'animals' },
  { emoji: '🐱', label: 'Cat',      category: 'animals' },
  { emoji: '🦊', label: 'Fox',      category: 'animals' },
  { emoji: '🐸', label: 'Frog',     category: 'animals' },
  { emoji: '🦁', label: 'Lion',     category: 'animals' },
  { emoji: '🐯', label: 'Tiger',    category: 'animals' },
  { emoji: '🦋', label: 'Butterfly',category: 'animals' },
  { emoji: '🦜', label: 'Parrot',   category: 'animals' },
  { emoji: '🐙', label: 'Octopus',  category: 'animals' },
  { emoji: '🐳', label: 'Whale',    category: 'animals' },
  // Sports
  { emoji: '⚽', label: 'Soccer',   category: 'sports' },
  { emoji: '🏀', label: 'Basketball',category: 'sports' },
  { emoji: '🎾', label: 'Tennis',   category: 'sports' },
  { emoji: '🏈', label: 'Football', category: 'sports' },
  { emoji: '🎱', label: 'Billiards',category: 'sports' },
  { emoji: '🏊', label: 'Swimmer',  category: 'sports' },
  { emoji: '🚴', label: 'Cyclist',  category: 'sports' },
  { emoji: '🧗', label: 'Climber',  category: 'sports' },
  // Vehicles
  { emoji: '🚀', label: 'Rocket',   category: 'vehicles' },
  { emoji: '🚗', label: 'Car',      category: 'vehicles' },
  { emoji: '🚂', label: 'Train',    category: 'vehicles' },
  { emoji: '🛸', label: 'UFO',      category: 'vehicles' },
  { emoji: '🚁', label: 'Helicopter',category: 'vehicles' },
  { emoji: '🛶', label: 'Canoe',    category: 'vehicles' },
  { emoji: '🏎️', label: 'Race Car', category: 'vehicles' },
  { emoji: '🛩️', label: 'Plane',    category: 'vehicles' },
  // Science
  { emoji: '🔬', label: 'Microscope',category: 'science' },
  { emoji: '🧬', label: 'DNA',      category: 'science' },
  { emoji: '⚗️', label: 'Beaker',   category: 'science' },
  { emoji: '🌋', label: 'Volcano',  category: 'science' },
  { emoji: '🌊', label: 'Wave',     category: 'science' },
  { emoji: '🪐', label: 'Planet',   category: 'science' },
  { emoji: '🧲', label: 'Magnet',   category: 'science' },
  { emoji: '💡', label: 'Lightbulb',category: 'science' },
  // Music
  { emoji: '🎸', label: 'Guitar',   category: 'music' },
  { emoji: '🎺', label: 'Trumpet',  category: 'music' },
  { emoji: '🥁', label: 'Drums',    category: 'music' },
  { emoji: '🎹', label: 'Piano',    category: 'music' },
  { emoji: '🎻', label: 'Violin',   category: 'music' },
  { emoji: '🎷', label: 'Saxophone',category: 'music' },
  { emoji: '🎤', label: 'Microphone',category: 'music' },
];

export const PUB_TRIVIA_ICON_EMOJIS = new Set(PUB_TRIVIA_ICONS.map((i) => i.emoji));

export const PUB_TRIVIA_ICON_CATEGORIES: PubTriviaIcon['category'][] = [
  'animals',
  'sports',
  'vehicles',
  'science',
  'music',
];

export const CATEGORY_LABELS: Record<PubTriviaIcon['category'], string> = {
  animals:  'Animals',
  sports:   'Sports',
  vehicles: 'Vehicles',
  science:  'Science',
  music:    'Music',
};
