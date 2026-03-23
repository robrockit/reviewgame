import Link from 'next/link';
import { CheckIcon } from '@heroicons/react/20/solid';

interface TeaserTier {
  name: string;
  price: string;
  ctaLabel: string;
  ctaHref: string;
  highlight: boolean;
  bullets: string[];
}

const tiers: TeaserTier[] = [
  {
    name: 'Free',
    price: '$0',
    ctaLabel: 'Get started free',
    ctaHref: '/signup',
    highlight: false,
    bullets: ['Up to 3 games', '5 teams per game', 'Community question banks'],
  },
  {
    name: 'Basic',
    price: '$4.99/mo',
    ctaLabel: 'Start free trial',
    ctaHref: '/signup',
    highlight: false,
    bullets: ['Unlimited games', 'Up to 10 teams', 'Custom question banks'],
  },
  {
    name: 'Premium',
    price: '$7.99/mo',
    ctaLabel: 'Start free trial',
    ctaHref: '/signup',
    highlight: true,
    bullets: ['Everything in Basic', 'Image questions', 'Priority support'],
  },
];

export default function PricingTeaser() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl p-6 border flex flex-col ${
                tier.highlight
                  ? 'border-blue-600 ring-2 ring-blue-600 bg-white'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-800">{tier.price}</p>
              <ul className="mt-4 space-y-2 flex-1">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckIcon className="h-4 w-4 text-green-500 flex-shrink-0" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`mt-6 block text-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tier.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tier.ctaLabel}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-700 transition-colors"
          >
            See full pricing &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
