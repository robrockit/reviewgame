'use client';

export default function GameListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-pulse"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <div className="h-6 bg-gray-200 rounded w-24"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
            <div className="h-9 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
