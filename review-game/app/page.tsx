import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import FeaturesSection from '@/components/marketing/FeaturesSection';
import PricingTeaser from '@/components/marketing/PricingTeaser';
import TestimonialsSection from '@/components/marketing/TestimonialsSection';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export default function Home() {
  return (
    <>
      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="min-h-[80vh] bg-gradient-to-b from-white to-gray-50 flex items-center pt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              Review games your students{' '}
              <span className="text-blue-600">actually want to play</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Create interactive Jeopardy-style review games in minutes. Real-time
              buzzers, Daily Doubles, and reusable question banks — all in your browser.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-colors shadow-sm"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-base hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              No credit card required &bull; Free plan available
            </p>
          </div>
        </section>

        <FeaturesSection />
        <PricingTeaser />
        <TestimonialsSection />
      </main>

      <MarketingFooter />
    </>
  );
}
