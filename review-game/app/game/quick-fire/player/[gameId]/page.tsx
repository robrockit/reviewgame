'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';
import { logger } from '@/lib/logger';
import { IconPicker } from '@/components/pub-trivia/IconPicker';
import type { PubTriviaQuestionForPlayer, PubTriviaRoundResult } from '@/types/pub-trivia';

type Phase =
  | 'loading'
  | 'join'
  | 'pending_approval'
  | 'lobby'
  | 'question'
  | 'answered'
  | 'round_results'
  | 'completed';

const PLAYER_KEY = (gameId: string) => `pt_player_${gameId}`;

interface StoredPlayer {
  playerId: string;
  deviceId: string;
  playerName: string;
  playerIcon: string | null;
  connectionStatus: 'pending' | 'connected';
}

export default function PubTriviaPlayerPage() {
  const params = useParams();
  const gameId = params?.gameId as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Player identity
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [myIcon, setMyIcon] = useState<string | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<PubTriviaQuestionForPlayer | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(0);
  const [questionDurationMs, setQuestionDurationMs] = useState(20_000);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
  } | null>(null);
  const [roundResults, setRoundResults] = useState<PubTriviaRoundResult[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [finalRankings, setFinalRankings] = useState<
    Array<{ id: string; playerName: string; playerIcon: string | null; score: number }>
  >([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasNextQuestion, setHasNextQuestion] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerIdRef = useRef<string | null>(null);

  const supabase = createClient();

  // Stable refs for values used in the timer interval
  const questionStartedAtRef = useRef(questionStartedAt);
  const questionDurationMsRef = useRef(questionDurationMs);
  useEffect(() => { questionStartedAtRef.current = questionStartedAt; }, [questionStartedAt]);
  useEffect(() => { questionDurationMsRef.current = questionDurationMs; }, [questionDurationMs]);

  // Check localStorage for existing player identity on mount
  useEffect(() => {
    if (!gameId) return;

    try {
      const stored = localStorage.getItem(PLAYER_KEY(gameId));
      if (stored) {
        const { playerId: pid, playerName: pname, playerIcon: picon, connectionStatus: cs } = JSON.parse(stored) as StoredPlayer;
        setPlayerId(pid);
        playerIdRef.current = pid;
        setPlayerName(pname);
        setMyIcon(picon ?? null);
        setPhase(cs === 'connected' ? 'lobby' : 'pending_approval');
        return;
      }
    } catch {
      // corrupt storage — proceed to join
    }

    setPhase('join');
  }, [gameId]);

  // While pending approval, listen for the teacher's approve/reject decision
  useEffect(() => {
    if (!gameId || phase !== 'pending_approval' || !playerId) return;

    const channel = supabase.channel(`pub-trivia:${gameId}`);
    channel
      .on('broadcast', { event: 'pt_player_approved' }, ({ payload }) => {
        const p = payload as { playerId: string };
        if (p.playerId !== playerIdRef.current) return;
        try {
          const stored = localStorage.getItem(PLAYER_KEY(gameId));
          if (stored) {
            const s = JSON.parse(stored) as StoredPlayer;
            localStorage.setItem(
              PLAYER_KEY(gameId),
              JSON.stringify({ ...s, connectionStatus: 'connected' } satisfies StoredPlayer),
            );
          }
        } catch {}
        setPhase('lobby');
      })
      .on('broadcast', { event: 'pt_player_rejected' }, ({ payload }) => {
        const p = payload as { playerId: string };
        if (p.playerId !== playerIdRef.current) return;
        try { localStorage.removeItem(PLAYER_KEY(gameId)); } catch {}
        setPlayerId(null);
        playerIdRef.current = null;
        setPlayerName('');
        setNameInput('');
        setActionError('Your name was not approved. Please choose a different name and try again.');
        setPhase('join');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, phase, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to realtime channel once we have a player identity
  useEffect(() => {
    if (!gameId || (phase !== 'lobby' && phase !== 'question' && phase !== 'answered' && phase !== 'round_results')) {
      return;
    }

    const channel = supabase.channel(`pub-trivia:${gameId}`);

    channel
      .on('broadcast', { event: 'pt_question_started' }, ({ payload }) => {
        const p = payload as {
          question: PubTriviaQuestionForPlayer;
          durationMs: number;
          startedAt: number;
        };
        setCurrentQuestion(p.question);
        setQuestionStartedAt(p.startedAt);
        setQuestionDurationMs(p.durationMs);
        setEliminatedIndices([]);
        setSelectedAnswer(null);
        setAnswerResult(null);
        setTimeRemaining(Math.ceil(p.durationMs / 1000));
        setPhase('question');
      })
      .on('broadcast', { event: 'pt_option_eliminated' }, ({ payload }) => {
        const p = payload as { eliminatedIndex: number };
        setEliminatedIndices((prev) =>
          prev.includes(p.eliminatedIndex) ? prev : [...prev, p.eliminatedIndex],
        );
      })
      .on('broadcast', { event: 'pt_question_ended' }, ({ payload }) => {
        const p = payload as {
          correctAnswer: string;
          results: PubTriviaRoundResult[];
          hasNextQuestion: boolean;
        };
        if (timerRef.current) clearInterval(timerRef.current);
        setCorrectAnswer(p.correctAnswer);
        setRoundResults(p.results);
        setHasNextQuestion(p.hasNextQuestion);
        // Update my score from results
        const myResult = p.results.find((r) => r.playerId === playerIdRef.current);
        if (myResult) {
          setMyScore((prev) => prev + myResult.pointsEarned);
          setAnswerResult({ isCorrect: myResult.isCorrect, pointsEarned: myResult.pointsEarned });
        }
        setPhase('round_results');
      })
      .on('broadcast', { event: 'pt_game_ended' }, ({ payload }) => {
        const p = payload as {
          finalRankings: Array<{ id: string; playerName: string; playerIcon: string | null; score: number }>;
        };
        if (timerRef.current) clearInterval(timerRef.current);
        setFinalRankings(p.finalRankings);
        setPhase('completed');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, phase === 'lobby']); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer for active question
  useEffect(() => {
    if (phase !== 'question') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - questionStartedAtRef.current;
      const durationMs = questionDurationMsRef.current;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
    }, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleJoin = useCallback(async () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setActionError('Please enter your name');
      return;
    }

    const deviceId = getDeviceId();
    if (!deviceId) {
      setActionError('Unable to identify your device. Please check browser settings.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/games/${gameId}/pub-trivia/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: trimmedName, deviceId, playerIcon: selectedIcon ?? undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? 'Failed to join game');
        return;
      }

      const pid = data.playerId as string;
      const pname = data.playerName as string;
      const picon = (data.playerIcon as string | null) ?? null;
      const connStatus: StoredPlayer['connectionStatus'] =
        (data.connectionStatus as string) === 'connected' ? 'connected' : 'pending';

      try {
        localStorage.setItem(
          PLAYER_KEY(gameId),
          JSON.stringify({ playerId: pid, deviceId, playerName: pname, playerIcon: picon, connectionStatus: connStatus } satisfies StoredPlayer),
        );
      } catch {
        // localStorage unavailable — session-only join
      }

      setPlayerId(pid);
      playerIdRef.current = pid;
      setPlayerName(pname);
      setMyIcon(picon);
      setMyScore(data.score ?? 0);
      setPhase(connStatus === 'connected' ? 'lobby' : 'pending_approval');
    } catch (err) {
      logger.error('Failed to join pub trivia game', err, { operation: 'joinPubTrivia', gameId });
      setActionError('Failed to join. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [gameId, nameInput, selectedIcon]);

  const handleSubmitAnswer = useCallback(
    async (answerText: string) => {
      if (!playerId || selectedAnswer !== null || !currentQuestion) return;

      const deviceId = getDeviceId();
      if (!deviceId) return;

      setSelectedAnswer(answerText);
      setActionError(null);

      try {
        const res = await fetch(`/api/games/${gameId}/pub-trivia/question/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, answerText, deviceId, questionId: currentQuestion.id }),
        });

        const data = await res.json();

        if (res.ok) {
          setAnswerResult({
            isCorrect: data.isCorrect as boolean,
            pointsEarned: data.pointsEarned as number,
          });
          setMyScore(data.totalScore as number);
          setPhase('answered');
        }
        // If 409 (already answered), stay in 'answered' phase — result will arrive via broadcast
      } catch (err) {
        logger.error('Failed to submit answer', err, { operation: 'submitPubTriviaAnswer', gameId });
      }
    },
    [gameId, playerId, selectedAnswer, currentQuestion],
  );

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-indigo-900">
        <p className="text-white text-lg">Loading…</p>
      </div>
    );
  }

  // ── JOIN FORM ──────────────────────────────────────────────────────────────
  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Join Quick Fire</h1>
          <p className="text-gray-500 text-sm text-center mb-4">Pick an icon and enter your name</p>

          {actionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionError}
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium text-gray-700">Icon</p>
              {selectedIcon && (
                <span className="text-xl">{selectedIcon}</span>
              )}
              {!selectedIcon && (
                <span className="text-xs text-gray-400">(optional)</span>
              )}
            </div>
            <IconPicker selected={selectedIcon} onChange={setSelectedIcon} />
          </div>

          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Your name"
            maxLength={50}
            autoFocus
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-indigo-500 focus:outline-none mb-4"
          />
          <button
            onClick={handleJoin}
            disabled={isSubmitting || !nameInput.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-lg transition-colors"
          >
            {isSubmitting ? 'Joining…' : 'Join Game'}
          </button>
        </div>
      </div>
    );
  }

  // ── PENDING APPROVAL (teacher reviewing name) ─────────────────────────────
  if (phase === 'pending_approval') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-sm">
          <div className="text-4xl font-bold mb-3">{playerName}</div>
          <div className="text-indigo-200 text-base mb-8">Waiting for teacher approval…</div>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <div className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
            <div className="h-3 w-3 rounded-full bg-white animate-bounce" />
          </div>
          <p className="text-indigo-200 text-sm">The teacher will review your name before you can join.</p>
        </div>
      </div>
    );
  }

  // ── LOBBY (waiting for teacher to start) ──────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-4xl font-bold mb-3">{playerName}</div>
          <div className="text-indigo-200 text-lg mb-8">You&apos;re in!</div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <div className="h-3 w-3 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
            <div className="h-3 w-3 rounded-full bg-white animate-bounce" />
          </div>
          <p className="text-indigo-200">Waiting for the teacher to start the game…</p>
        </div>
      </div>
    );
  }

  // ── QUESTION ACTIVE ────────────────────────────────────────────────────────
  if ((phase === 'question' || phase === 'answered') && currentQuestion) {
    const optionLetters = ['A', 'B', 'C', 'D'];
    const timerFraction = timeRemaining / (questionDurationMs / 1000);
    const timerColor =
      timeRemaining <= 5 ? 'bg-red-500' : timeRemaining <= 10 ? 'bg-yellow-500' : 'bg-green-500';

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Score bar */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-gray-300 flex items-center gap-1.5">
            {myIcon && <span className="text-base leading-none">{myIcon}</span>}
            {playerName}
          </span>
          <span className="font-mono text-yellow-400 font-bold">{myScore.toLocaleString()} pts</span>
        </div>

        {/* Timer bar */}
        <div className="h-2 bg-gray-700">
          <div
            className={`h-full transition-all duration-300 ${timerColor}`}
            style={{ width: `${timerFraction * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Timer display */}
          <div className="text-center">
            <span
              className={`text-5xl font-bold tabular-nums ${
                timeRemaining <= 5 ? 'text-red-400' : 'text-white'
              }`}
            >
              {timeRemaining}
            </span>
          </div>

          {/* Question text */}
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-base font-medium leading-relaxed">{currentQuestion.questionText}</p>
          </div>

          {/* Answer options */}
          <div className="grid grid-cols-1 gap-3 flex-1">
            {currentQuestion.options.map((opt, i) => {
              const isEliminated = eliminatedIndices.includes(i);
              const isSelected = selectedAnswer === opt;
              const isCorrect = phase === 'answered' && answerResult?.isCorrect && isSelected;
              const isWrong = phase === 'answered' && !answerResult?.isCorrect && isSelected;

              return (
                <button
                  key={i}
                  onClick={() => handleSubmitAnswer(opt)}
                  disabled={phase === 'answered' || isEliminated || selectedAnswer !== null}
                  className={`
                    w-full p-4 rounded-xl text-left font-medium transition-all border-2
                    ${isEliminated ? 'opacity-20 cursor-not-allowed border-gray-700 bg-gray-800 line-through' : ''}
                    ${isCorrect ? 'border-green-400 bg-green-900' : ''}
                    ${isWrong ? 'border-red-400 bg-red-900' : ''}
                    ${!isEliminated && !isSelected && phase === 'question'
                      ? 'border-indigo-500 bg-indigo-900 hover:bg-indigo-800 active:scale-95'
                      : ''}
                    ${!isEliminated && !isSelected && phase === 'answered'
                      ? 'border-gray-700 bg-gray-800 opacity-50'
                      : ''}
                  `}
                >
                  <span className="text-indigo-300 mr-3">{optionLetters[i]}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Answered state feedback */}
          {phase === 'answered' && answerResult && (
            <div
              className={`text-center py-3 rounded-xl font-semibold ${
                answerResult.isCorrect
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}
            >
              {answerResult.isCorrect
                ? `Correct! +${answerResult.pointsEarned} pts`
                : 'Wrong answer'}
              {' — '}Waiting for results…
            </div>
          )}
          {phase === 'answered' && !answerResult && (
            <div className="text-center py-3 rounded-xl font-semibold bg-gray-800 text-gray-400">
              Answer submitted — waiting for results…
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ROUND RESULTS ──────────────────────────────────────────────────────────
  if (phase === 'round_results') {
    const myResult = roundResults.find((r) => r.playerId === playerId);

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 gap-5">
        {/* My result */}
        <div
          className={`w-full max-w-sm p-5 rounded-2xl text-center ${
            myResult?.isCorrect ? 'bg-green-900 border-2 border-green-500' : 'bg-red-900 border-2 border-red-600'
          }`}
        >
          <p className="text-2xl font-bold mb-1">
            {myResult?.isCorrect ? 'Correct!' : myResult ? 'Wrong' : 'No answer'}
          </p>
          <p className="text-5xl font-bold text-yellow-400 mb-1">
            +{myResult?.pointsEarned ?? 0}
          </p>
          <p className="text-sm text-gray-300">Total: {myScore.toLocaleString()} pts</p>
        </div>

        {/* Correct answer */}
        {correctAnswer && (
          <div className="w-full max-w-sm bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Correct Answer</p>
            <p className="text-lg font-semibold text-green-400">{correctAnswer}</p>
          </div>
        )}

        {/* Next message */}
        <p className="text-gray-400 text-sm text-center">
          {hasNextQuestion
            ? 'Get ready — next question coming up…'
            : 'Final question done — waiting for teacher to end the game…'}
        </p>
      </div>
    );
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (phase === 'completed') {
    const myRank = finalRankings.findIndex((r) => r.id === playerId) + 1;

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 gap-5">
        <h1 className="text-3xl font-bold">Game Over!</h1>

        {myRank > 0 && (
          <div className="bg-gray-800 rounded-2xl p-5 text-center w-full max-w-sm">
            <p className="text-gray-400 text-sm mb-1">Your position</p>
            <p className="text-6xl font-bold text-yellow-400 mb-1">
              {myRank === 1 ? '1st' : myRank === 2 ? '2nd' : myRank === 3 ? '3rd' : `${myRank}th`}
            </p>
            <p className="text-gray-300">
              {myScore.toLocaleString()} pts
            </p>
          </div>
        )}

        <div className="w-full max-w-sm space-y-2">
          {finalRankings.slice(0, 10).map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                r.id === playerId ? 'bg-indigo-900 border border-indigo-500' : 'bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-6 text-right text-sm">{i + 1}.</span>
                {r.playerIcon && <span className="text-base leading-none">{r.playerIcon}</span>}
                <span className="text-sm font-medium">{r.playerName}</span>
              </div>
              <span className="text-sm font-mono text-yellow-400">{r.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
