'use client';

import { useState } from 'react';
import { BuzzButton, type BuzzButtonState } from '@/components/student';

/**
 * Test page for BuzzButton component
 * Navigate to http://localhost:3000/test-buzz to view
 */
export default function TestBuzzPage() {
  const [currentState, setCurrentState] = useState<BuzzButtonState>('active');
  const [buzzLog, setBuzzLog] = useState<string[]>([]);

  const handleBuzz = () => {
    const timestamp = new Date().toLocaleTimeString();
    setBuzzLog((prev) => [`Buzzed at ${timestamp}`, ...prev].slice(0, 10));
    setCurrentState('buzzed');
  };

  const resetButton = () => {
    setCurrentState('active');
  };

  const cycleStates = () => {
    const states: BuzzButtonState[] = ['active', 'buzzed', 'answering', 'waiting'];
    const currentIndex = states.indexOf(currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    setCurrentState(states[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Buzz Button Component Test
          </h1>
          <p className="text-gray-600">Testing RG-29 implementation</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Button Display */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Live Button
            </h2>

            <BuzzButton
              state={currentState}
              onBuzz={handleBuzz}
              size={250}
            />

            {/* Current State Display */}
            <div className="mt-8 text-center">
              <p className="text-sm font-semibold text-gray-600 mb-2">Current State:</p>
              <span className={`
                px-4 py-2 rounded-full font-bold text-sm
                ${currentState === 'active' ? 'bg-red-100 text-red-800' : ''}
                ${currentState === 'buzzed' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${currentState === 'answering' ? 'bg-green-100 text-green-800' : ''}
                ${currentState === 'waiting' ? 'bg-gray-100 text-gray-800' : ''}
              `}>
                {currentState.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Controls & Info */}
          <div className="space-y-6">
            {/* State Controls */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                State Controls
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCurrentState('active')}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
                >
                  Active
                </button>
                <button
                  onClick={() => setCurrentState('buzzed')}
                  className="px-4 py-3 bg-yellow-400 text-blue-900 rounded-lg hover:bg-yellow-500 font-semibold transition-colors"
                >
                  Buzzed
                </button>
                <button
                  onClick={() => setCurrentState('answering')}
                  className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors"
                >
                  Answering
                </button>
                <button
                  onClick={() => setCurrentState('waiting')}
                  className="px-4 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition-colors"
                >
                  Waiting
                </button>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={cycleStates}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                >
                  🔄 Cycle States
                </button>
                <button
                  onClick={resetButton}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  ↻ Reset
                </button>
              </div>
            </div>

            {/* Buzz Log */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Buzz Log
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {buzzLog.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No buzzes yet. Click the button when it is active!
                  </p>
                ) : (
                  buzzLog.map((log, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700"
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Features Implemented
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>250×250px circular button</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Four states (active, buzzed, answering, waiting)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Touch-friendly design</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>High contrast colors</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Sound effects (requires buzz.mp3)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Haptic feedback (mobile)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Pulsing animation (answering state)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✅</span>
                  <span>Visual feedback on press</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            📝 Testing Notes
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Sound file should be placed at <code className="bg-blue-100 px-1 rounded">public/sounds/buzz.mp3</code></li>
            <li>Haptic feedback only works on mobile devices with vibration support</li>
            <li>Test on actual mobile devices for best results</li>
            <li>The button only responds when in the &quot;Active&quot; state</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
