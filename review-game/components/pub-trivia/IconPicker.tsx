'use client';

import {
  PUB_TRIVIA_ICONS,
  PUB_TRIVIA_ICON_CATEGORIES,
  CATEGORY_LABELS,
} from '@/lib/constants/pubTriviaIcons';

interface IconPickerProps {
  selected: string | null;
  onChange: (emoji: string | null) => void;
}

export function IconPicker({ selected, onChange }: IconPickerProps) {
  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
      <div className="max-h-48 overflow-y-auto p-3 space-y-3">
        {PUB_TRIVIA_ICON_CATEGORIES.map((category) => {
          const icons = PUB_TRIVIA_ICONS.filter((i) => i.category === category);
          return (
            <div key={category}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="flex flex-wrap gap-1">
                {icons.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    type="button"
                    title={label}
                    onClick={() => onChange(selected === emoji ? null : emoji)}
                    className={`
                      text-2xl p-1.5 rounded-lg transition-all
                      ${selected === emoji
                        ? 'ring-2 ring-indigo-500 bg-indigo-50 scale-110'
                        : 'hover:bg-gray-100 hover:scale-105'}
                    `}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
