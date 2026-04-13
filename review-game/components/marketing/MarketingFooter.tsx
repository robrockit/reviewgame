import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          {/* Left: logo + tagline */}
          <div>
            <span className="text-xl font-bold text-white">Review Game</span>
            <p className="mt-2 text-sm text-gray-400 max-w-xs">
              Jeopardy-style review games for teachers. Free to start — no setup required.
            </p>
          </div>

          {/* Right: nav links */}
          <nav aria-label="Footer" className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm">
            <Link
              href="/for-teachers"
              className="text-gray-400 hover:text-white transition-colors"
            >
              For Teachers
            </Link>
            <Link
              href="/pricing"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Sign Up
            </Link>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-gray-800 pt-6 text-sm text-gray-500 text-center">
          &copy; 2024 Review Game. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
