import type { ComponentType, SVGProps } from 'react';
import {
  BoltIcon,
  StarIcon,
  BookOpenIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: BoltIcon,
    title: 'Buzzer System',
    description:
      'Real-time team buzzers that work across any device — no app download required.',
  },
  {
    icon: StarIcon,
    title: 'Daily Double',
    description:
      'Randomly placed Daily Double squares keep every game unpredictable and exciting.',
  },
  {
    icon: BookOpenIcon,
    title: 'Question Banks',
    description:
      'Build reusable question banks by subject and share them with your school.',
  },
  {
    icon: PhotoIcon,
    title: 'Image Support',
    description:
      'Add images to any question for visual learners and diagram-based challenges.',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Everything you need to run a great review game
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Built for teachers — no tech expertise required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white shadow-sm rounded-lg p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-50 mb-4">
                <feature.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
