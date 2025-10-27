'use client';

import { JoinQRCode } from '@/components/teacher';

/**
 * Test page for QR Code component
 * Navigate to http://localhost:3000/test-qr to view
 */
export default function TestQRPage() {
  // Using a test game ID
  const testGameId = 'test-game-123';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            QR Code Component Test
          </h1>
          <p className="text-gray-600">
            Testing the JoinQRCode component for RG-27
          </p>
        </div>

        <JoinQRCode gameId={testGameId} />

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Component Details
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✅ <strong>Size:</strong> 200×200px</li>
            <li>✅ <strong>Error Correction:</strong> Level H (High)</li>
            <li>✅ <strong>Colors:</strong> Black on White</li>
            <li>✅ <strong>URL Format:</strong> {`{APP_URL}/game/team/join/{gameId}`}</li>
            <li>✅ <strong>Test Game ID:</strong> {testGameId}</li>
          </ul>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            🧪 Testing Instructions
          </h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Scan the QR code with your mobile device</li>
            <li>Verify it opens the correct URL</li>
            <li>Try different QR scanner apps for compatibility</li>
            <li>Test at various distances and lighting conditions</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
