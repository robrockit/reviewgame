/**
 * UsageStats Component
 *
 * Displays usage statistics for FREE tier users
 */

interface UsageStatsProps {
  gamesCreated: number;
  gamesLimit: number;
  onUpgrade: () => void;
}

export default function UsageStats({ gamesCreated, gamesLimit, onUpgrade }: UsageStatsProps) {
  const percentage = (gamesCreated / gamesLimit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = gamesCreated >= gamesLimit;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Usage Statistics</h2>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Games Created</span>
            <span className="text-sm font-medium text-gray-900">
              {gamesCreated} of {gamesLimit}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden"
            role="progressbar"
            aria-valuenow={gamesCreated}
            aria-valuemin={0}
            aria-valuemax={gamesLimit}
            aria-label={`Games created: ${gamesCreated} of ${gamesLimit}`}
          >
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                isAtLimit
                  ? 'bg-red-600'
                  : isNearLimit
                  ? 'bg-yellow-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Warning Message */}
        {isNearLimit && (
          <div className={`p-4 rounded-lg ${isAtLimit ? 'bg-red-50' : 'bg-yellow-50'}`}>
            <p className={`text-sm ${isAtLimit ? 'text-red-800' : 'text-yellow-800'}`}>
              {isAtLimit ? (
                <span className="font-medium">You&apos;ve reached your game limit.</span>
              ) : (
                <span className="font-medium">You&apos;re approaching your game limit.</span>
              )}
              {' '}
              Upgrade to create unlimited games and unlock premium features.
            </p>
          </div>
        )}

        {/* Upgrade CTA */}
        <button
          onClick={onUpgrade}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Upgrade to Unlock More
        </button>
      </div>
    </div>
  );
}
