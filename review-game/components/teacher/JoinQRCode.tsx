'use client';

import { QRCodeSVG } from 'qrcode.react';

interface JoinQRCodeProps {
  gameId: string;
}

export default function JoinQRCode({ gameId }: JoinQRCodeProps) {
  // Get the application URL from environment or construct it
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
                 (typeof window !== 'undefined' ? window.location.origin : '');

  // Format: {APP_URL}/game/team/join/{gameId}
  const joinUrl = `${appUrl}/game/team/join/${gameId}`;

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

      {/* QR Code with Level H error correction */}
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
}
