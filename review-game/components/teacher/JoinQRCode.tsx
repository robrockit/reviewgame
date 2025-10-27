'use client';

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface JoinQRCodeProps {
  gameId: string;
}

/**
 * QR Code component for team joining
 *
 * Generates a scannable QR code that directs students to the team join page.
 * Implements specifications from Phase 7, Section 7.2.
 *
 * @param gameId - The unique identifier for the game session
 *
 * TODO: Implement the /game/team/join/[gameId] route (Phase 8)
 * See Phase 8 requirements in Confluence: Section 8.1 Team Join Flow
 */
export const JoinQRCode: React.FC<JoinQRCodeProps> = ({ gameId }) => {
  // Validate required environment variable
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL environment variable is not configured');
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-red-50 rounded-lg border-2 border-red-200">
        <div className="text-center">
          <h3 className="text-xl font-bold text-red-800 mb-2">
            Configuration Error
          </h3>
          <p className="text-sm text-red-700">
            QR Code cannot be generated: NEXT_PUBLIC_APP_URL is not configured.
          </p>
          <p className="text-xs text-red-600 mt-2">
            Please set NEXT_PUBLIC_APP_URL in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  // Validate gameId
  if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
    console.error('JoinQRCode: Invalid gameId provided:', gameId);
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-yellow-50 rounded-lg border-2 border-yellow-200">
        <div className="text-center">
          <h3 className="text-xl font-bold text-yellow-800 mb-2">
            Invalid Game ID
          </h3>
          <p className="text-sm text-yellow-700">
            Cannot generate QR code: Game ID is missing or invalid.
          </p>
        </div>
      </div>
    );
  }

  // Memoize URL construction for performance
  // Format: {APP_URL}/game/team/join/{gameId}
  // URL encode gameId to prevent injection and handle special characters
  const joinUrl = useMemo(
    () => `${appUrl}/game/team/join/${encodeURIComponent(gameId)}`,
    [appUrl, gameId]
  );

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg shadow-md">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Team Join QR Code
        </h3>
        <p className="text-sm text-gray-600">
          Students can scan this code to join the game
        </p>
      </div>

      {/* QR Code with Level H error correction (30% recovery) */}
      <div className="bg-white p-4 rounded-lg border-4 border-gray-200">
        <QRCodeSVG
          value={joinUrl}
          size={200}
          level="H"
          bgColor="#ffffff"
          fgColor="#000000"
          includeMargin={false}
        />
      </div>

      {/* Text URL below QR code */}
      <div className="text-center max-w-md">
        <p className="text-xs text-gray-500 mb-1">Or enter this URL:</p>
        <p className="text-sm font-mono text-gray-700 break-all bg-gray-50 p-2 rounded">
          {joinUrl}
        </p>
      </div>
    </div>
  );
};
