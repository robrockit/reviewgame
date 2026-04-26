'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { PubTriviaQuestionForPlayer, PubTriviaPlayer, PubTriviaRoundResult } from '@/types/pub-trivia';
import { OPTION_ELIMINATION_THRESHOLDS } from '@/types/pub-trivia';

type Phase =
  | 'loading'
  | 'lobby'
  | 'between_questions'
  | 'question_active'
  | 'round_results'
  | 'completed';

interface StartQuestionResponse {
  questionIndex: number;
  question: PubTriviaQuestionForPlayer;
  startedAt: number;
  correctAnswerIndex: number;
  durationMs: number;
}

interface EndQuestionResponse {
  correctAnswer: string;
  results: PubTriviaRoundResult[];
  hasNextQuestion: boolean;
}

interface EndGameResponse {
  finalRankings: Array<{ id: string; playerName: string; playerIcon: string | null; score: number; connectionStatus: string | null }>;
}

export default function PubTriviaTeacherPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.gameId as string;

  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<PubTriviaQuestionForPlayer | null>(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [players, setPlayers] = useState<PubTriviaPlayer[]>([]);
  const [roundResults, setRoundResults] = useState<PubTriviaRoundResult[]>([]);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null);
  const [hasNextQuestion, setHasNextQuestion] = useState(false);

  // Timer state (managed via ref to avoid stale closures in interval)
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [answerTally, setAnswerTally] = useState<Record<string, number>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eliminationFiredRef = useRef({ at40: false, at70: false });
  // Pre-computed wrong option indices for the current question (set by handleStartQuestion)
  const wrongOptionIndicesRef = useRef<number[]>([]);
  const questionDurationMsRef = useRef(20_000);
  const questionStartedAtRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/game/quick-fire/player/${gameId}`
      : '';

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({ type: 'broadcast', event, payload });
    },
    [],
  );

  // Set up realtime channel (broadcasts + Postgres Changes for new player joins)
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase.channel(`pub-trivia:${gameId}`);
    channel
      .on('broadcast', { event: 'pt_all_answered' }, ({ payload }) => {
        const p = payload as { playerCount?: number };
        setAnswerCount(p.playerCount ?? 0);
      })
      .on('broadcast', { event: 'pt_answer_tally' }, ({ payload }) => {
        const p = payload as { tally: Record<string, number>; totalAnswered: number };
        setAnswerTally(p.tally);
        setAnswerCount(p.totalAnswered);
      })
      // Detect new players: the join route patches team_name + connection_status='pending'
      // in a single UPDATE, so this event fires once with the full player details.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'teams', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const t = payload.new as {
            id: string;
            team_name: string | null;
            connection_status: string | null;
            score: number | null;
            player_icon: string | null;
          };
          if (t.connection_status !== 'pending') return;
          setPlayers((prev) => {
            if (prev.some((p) => p.id === t.id)) return prev;
            return [
              ...prev,
              { id: t.id, playerName: t.team_name ?? 'Player', playerIcon: t.player_icon ?? null, score: t.score ?? 0, connectionStatus: 'pending' },
            ];
          });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gameId is stable per page load
  }, [gameId]);

  // Load initial game state
  useEffect(() => {
    if (!gameId) return;

    const loadGame = async () => {
      try {
        const supabaseClient = createClient();

        const { data: game, error: gameError } = await supabaseClient
          .from('games')
          .select('status, current_question_index, pub_trivia_question_order, current_question_started_at, timer_seconds')
          .eq('id', gameId)
          .single();

        if (gameError || !game) {
          setLoadError('Game not found');
          return;
        }

        const { data: teams } = await supabaseClient
          .from('teams')
          .select('id, team_name, score, connection_status, player_icon')
          .eq('game_id', gameId)
          .order('score', { ascending: false });

        setPlayers(
          (teams ?? []).map((t) => ({
            id: t.id,
            playerName: t.team_name ?? 'Player',
            playerIcon: t.player_icon ?? null,
            score: t.score ?? 0,
            connectionStatus: t.connection_status ?? 'pending',
          })),
        );

        if (game.status === 'setup') {
          setPhase('lobby');
        } else if (game.status === 'completed') {
          setPhase('completed');
        } else if (game.status === 'in_progress') {
          const order = game.pub_trivia_question_order as string[] | null;
          const questionIndex = game.current_question_index ?? 0;
          setTotalQuestions(order?.length ?? 0);
          setCurrentQuestionIndex(questionIndex);

          if (game.current_question_started_at) {
            // Restore timer refs before setPhase so the interval reads correct values on the first tick
            questionStartedAtRef.current = new Date(game.current_question_started_at).getTime();
            questionDurationMsRef.current = (game.timer_seconds ?? 20) * 1_000;
            // wrongOptionIndicesRef stays [] — the original shuffled order is not stored in DB,
            // so elimination broadcasts are suppressed rather than risk targeting the wrong indices

            // Fetch the active question for display (options will be in unshuffled DB order)
            if (order && questionIndex < order.length) {
              const { data: q } = await supabaseClient
                .from('questions')
                .select('id, question_text, answer_text, category, mc_options')
                .eq('id', order[questionIndex])
                .single();
              if (q) {
                const wrongOpts = (q.mc_options as string[]) ?? [];
                const allOptions = [...wrongOpts, q.answer_text];
                setCurrentQuestion({ id: q.id, questionText: q.question_text, category: q.category, options: allOptions });
                setCorrectAnswerIndex(allOptions.length - 1);
              }
            }
            setPhase('question_active');
          } else {
            setPhase('between_questions');
          }
        }
      } catch (err) {
        logger.error('Failed to load pub trivia teacher page', err, {
          operation: 'loadPubTriviaTeacher',
          gameId,
        });
        setLoadError('Failed to load game');
      }
    };

    loadGame();
  }, [gameId]);

  // Start question timer when phase becomes 'question_active'
  useEffect(() => {
    if (phase !== 'question_active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    eliminationFiredRef.current = { at40: false, at70: false };

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - questionStartedAtRef.current;
      const durationMs = questionDurationMsRef.current;
      const fraction = elapsed / durationMs;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setTimeRemaining(remaining);

      if (fraction >= OPTION_ELIMINATION_THRESHOLDS[0] && !eliminationFiredRef.current.at40) {
        eliminationFiredRef.current.at40 = true;
        const idx = wrongOptionIndicesRef.current[0];
        if (idx !== undefined) {
          setEliminatedIndices([idx]);
          broadcast('pt_option_eliminated', { eliminatedIndex: idx });
        }
      }
      if (fraction >= OPTION_ELIMINATION_THRESHOLDS[1] && !eliminationFiredRef.current.at70) {
        eliminationFiredRef.current.at70 = true;
        const idx = wrongOptionIndicesRef.current[1];
        if (idx !== undefined) {
          setEliminatedIndices((prev) => [...prev, idx]);
          broadcast('pt_option_eliminated', { eliminatedIndex: idx });
        }
      }

      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, broadcast]);

  const handleApprove = useCallback(
    async (pid: string, pname: string) => {
      setIsApproving(pid);
      try {
        const res = await fetch(`/api/games/${gameId}/pub-trivia/approve-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: pid, approved: true }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setActionError(d.error ?? 'Failed to approve player');
          return;
        }
        setPlayers((prev) =>
          prev.map((p) => (p.id === pid ? { ...p, connectionStatus: 'connected' } : p)),
        );
        broadcast('pt_player_approved', { playerId: pid, playerName: pname });
      } catch (err) {
        logger.error('Failed to approve player', err, { operation: 'approvePubTriviaPlayer', gameId });
        setActionError('Failed to approve player');
      } finally {
        setIsApproving(null);
      }
    },
    [gameId, broadcast],
  );

  const handleReject = useCallback(
    async (pid: string) => {
      setIsApproving(pid);
      try {
        const res = await fetch(`/api/games/${gameId}/pub-trivia/approve-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: pid, approved: false }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setActionError(d.error ?? 'Failed to reject player');
          return;
        }
        setPlayers((prev) => prev.filter((p) => p.id !== pid));
        broadcast('pt_player_rejected', { playerId: pid });
      } catch (err) {
        logger.error('Failed to reject player', err, { operation: 'rejectPubTriviaPlayer', gameId });
        setActionError('Failed to reject player');
      } finally {
        setIsApproving(null);
      }
    },
    [gameId, broadcast],
  );

  const handleStartGame = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/pub-trivia/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? 'Failed to start game');
        return;
      }
      setTotalQuestions(data.totalQuestions as number);
      setPlayers(
        (data.players as Array<{ id: string; playerName: string; playerIcon: string | null; score: number; connectionStatus: string | null }>).map((p) => ({
          id: p.id,
          playerName: p.playerName,
          playerIcon: p.playerIcon ?? null,
          score: p.score,
          connectionStatus: p.connectionStatus ?? 'connected',
        })),
      );
      setCurrentQuestionIndex(0);
      setPhase('between_questions');
    } catch (err) {
      logger.error('Failed to start pub trivia game', err, { operation: 'startPubTriviaGame', gameId });
      setActionError('Failed to start game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartQuestion = async () => {
    setIsSubmitting(true);
    setAnswerCount(0);
    setAnswerTally({});
    setEliminatedIndices([]);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/pub-trivia/question/start`, { method: 'POST' });
      const data = (await res.json()) as Partial<StartQuestionResponse>;
      if (!res.ok) {
        setActionError((data as { error?: string }).error ?? 'Failed to start question');
        return;
      }
      const { question, correctAnswerIndex: corrIdx, startedAt, durationMs } = data as StartQuestionResponse;

      setCurrentQuestion(question);
      setCorrectAnswerIndex(corrIdx);

      // Pre-compute wrong option indices for the timer
      wrongOptionIndicesRef.current = question.options
        .map((_, i) => i)
        .filter((i) => i !== corrIdx);
      questionDurationMsRef.current = durationMs;
      questionStartedAtRef.current = startedAt;
      setTimeRemaining(Math.ceil(durationMs / 1000));

      setPhase('question_active');

      broadcast('pt_question_started', {
        questionIndex: data.questionIndex,
        question,
        durationMs,
        startedAt,
      });
    } catch (err) {
      logger.error('Failed to start pub trivia question', err, { operation: 'startPubTriviaQuestion', gameId });
      setActionError('Failed to start question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndQuestion = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/pub-trivia/question/end`, { method: 'POST' });
      const data = (await res.json()) as Partial<EndQuestionResponse>;
      if (!res.ok) {
        setActionError((data as { error?: string }).error ?? 'Failed to end question');
        return;
      }
      const { correctAnswer, results, hasNextQuestion: nextQ } = data as EndQuestionResponse;

      setRoundResults(results);
      setLastCorrectAnswer(correctAnswer);
      setHasNextQuestion(nextQ);

      // Update player scores from results
      const scoreGains = new Map<string, number>(results.map((r) => [r.playerId, r.pointsEarned]));
      setPlayers((prev) =>
        [...prev]
          .map((p) => ({ ...p, score: p.score + (scoreGains.get(p.id) ?? 0) }))
          .sort((a, b) => b.score - a.score),
      );
      setCurrentQuestionIndex((prev) => prev + 1);
      setPhase('round_results');

      broadcast('pt_question_ended', { correctAnswer, results, hasNextQuestion: nextQ });
    } catch (err) {
      logger.error('Failed to end pub trivia question', err, { operation: 'endPubTriviaQuestion', gameId });
      setActionError('Failed to end question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndGame = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/pub-trivia/end`, { method: 'POST' });
      const data = (await res.json()) as Partial<EndGameResponse>;
      if (!res.ok) {
        setActionError((data as { error?: string }).error ?? 'Failed to end game');
        return;
      }
      const { finalRankings } = data as EndGameResponse;
      setPlayers(
        finalRankings.map((r) => ({
          id: r.id,
          playerName: r.playerName,
          playerIcon: r.playerIcon ?? null,
          score: r.score,
          connectionStatus: r.connectionStatus ?? 'connected',
        })),
      );
      setPhase('completed');
      broadcast('pt_game_ended', { finalRankings });
    } catch (err) {
      logger.error('Failed to end pub trivia game', err, { operation: 'endPubTriviaGame', gameId });
      setActionError('Failed to end game');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400 text-lg">{loadError ?? 'Loading…'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Quick Fire — Teacher View</h1>
            <p className="text-sm text-gray-400">
              {phase === 'lobby' && 'Waiting for players to join'}
              {phase === 'between_questions' &&
                `Ready for Question ${currentQuestionIndex + 1} of ${totalQuestions}`}
              {phase === 'question_active' &&
                `Question ${currentQuestionIndex + 1} of ${totalQuestions} — Active`}
              {phase === 'round_results' &&
                `Question ${currentQuestionIndex} of ${totalQuestions} — Results`}
              {phase === 'completed' && 'Game Over'}
            </p>
          </div>
          {phase === 'lobby' && (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {actionError && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
            {actionError}
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (() => {
          const pendingPlayers = players.filter((p) => p.connectionStatus !== 'connected');
          const approvedPlayers = players.filter((p) => p.connectionStatus === 'connected');
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* QR code */}
              <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center gap-4">
                <h2 className="text-base font-semibold">Scan to Join</h2>
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={joinUrl} size={180} />
                </div>
                <p className="text-xs text-gray-400 text-center break-all">{joinUrl}</p>
              </div>

              {/* Approval panel */}
              <div className="bg-gray-800 rounded-xl p-6 flex flex-col gap-4">
                {/* Pending section */}
                <div>
                  <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
                    Waiting for approval
                    {pendingPlayers.length > 0 && (
                      <span className="text-sm font-normal text-yellow-400 bg-yellow-900 bg-opacity-40 px-2 py-0.5 rounded-full">
                        {pendingPlayers.length}
                      </span>
                    )}
                  </h2>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {pendingPlayers.length === 0 ? (
                      <p className="text-gray-500 text-sm">No one waiting</p>
                    ) : (
                      pendingPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-1.5 border-b border-gray-700"
                        >
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            {p.playerIcon && <span className="text-base leading-none">{p.playerIcon}</span>}
                            {p.playerName}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleApprove(p.id, p.playerName)}
                              disabled={isApproving === p.id}
                              className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                            >
                              {isApproving === p.id ? '…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(p.id)}
                              disabled={isApproving === p.id}
                              className="px-3 py-1 text-xs bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Approved section */}
                <div>
                  <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
                    Approved
                    {approvedPlayers.length > 0 && (
                      <span className="text-sm font-normal text-green-400 bg-green-900 bg-opacity-40 px-2 py-0.5 rounded-full">
                        {approvedPlayers.length}
                      </span>
                    )}
                  </h2>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {approvedPlayers.length === 0 ? (
                      <p className="text-gray-500 text-sm">No players approved yet</p>
                    ) : (
                      approvedPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center py-1 border-b border-gray-700"
                        >
                          <span className="text-sm flex items-center gap-1.5">
                            {p.playerIcon && <span className="text-base leading-none">{p.playerIcon}</span>}
                            {p.playerName}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={handleStartGame}
                  disabled={isSubmitting || approvedPlayers.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                >
                  {isSubmitting
                    ? 'Starting…'
                    : `Start Game (${approvedPlayers.length} player${approvedPlayers.length !== 1 ? 's' : ''})`}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── BETWEEN QUESTIONS ── */}
        {phase === 'between_questions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1">Up next</p>
                <p className="text-5xl font-bold">Q{currentQuestionIndex + 1}</p>
                <p className="text-gray-400 text-sm mt-1">of {totalQuestions}</p>
              </div>
              <button
                onClick={handleStartQuestion}
                disabled={isSubmitting}
                className="px-10 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl font-bold text-lg transition-colors"
              >
                {isSubmitting ? 'Starting…' : 'Start Question'}
              </button>
              {currentQuestionIndex >= totalQuestions && (
                <button
                  onClick={handleEndGame}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl font-semibold transition-colors"
                >
                  End Game
                </button>
              )}
            </div>
            <Leaderboard players={players} />
          </div>
        )}

        {/* ── QUESTION ACTIVE ── */}
        {phase === 'question_active' && currentQuestion && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <p className="text-lg font-semibold flex-1">{currentQuestion.questionText}</p>
                <div className="flex flex-col items-center min-w-[3rem]">
                  <span
                    className={`text-4xl font-bold tabular-nums ${
                      timeRemaining <= 5 ? 'text-red-400' : 'text-blue-400'
                    }`}
                  >
                    {timeRemaining}
                  </span>
                  <span className="text-xs text-gray-500">sec</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {currentQuestion.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-sm border-2 transition-opacity ${
                      eliminatedIndices.includes(i)
                        ? 'opacity-25 line-through border-gray-700 bg-gray-700'
                        : i === correctAnswerIndex
                          ? 'border-green-500 bg-green-900 bg-opacity-30'
                          : 'border-gray-600 bg-gray-700'
                    }`}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {i === correctAnswerIndex && (
                      <span className="ml-2 text-xs text-green-400">(correct)</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Live answer distribution */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Live Responses — {answerCount} / {players.length} answered
                </p>
                <div className="space-y-2">
                  {currentQuestion.options.map((opt, i) => {
                    const count = answerTally[opt] ?? 0;
                    const pct = answerCount > 0 ? Math.round((count / answerCount) * 100) : 0;
                    const isCorrect = i === correctAnswerIndex;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4 flex-none text-right">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div className="flex-1 bg-gray-700 rounded-full h-3.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isCorrect ? 'bg-green-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-300 w-16 text-right flex-none tabular-nums">
                          {pct}%&nbsp;({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleEndQuestion}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
                >
                  {isSubmitting ? 'Ending…' : 'End Question'}
                </button>
              </div>
            </div>

            <Leaderboard players={players} compact />
          </div>
        )}

        {/* ── ROUND RESULTS ── */}
        {phase === 'round_results' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-1">Round Results</h2>
              {lastCorrectAnswer && (
                <p className="text-sm text-gray-400 mb-4">
                  Correct answer:{' '}
                  <span className="text-green-400 font-medium">{lastCorrectAnswer}</span>
                </p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                {roundResults.length === 0 ? (
                  <p className="text-gray-400 text-sm">No answers submitted this round</p>
                ) : (
                  roundResults.map((r) => (
                    <div
                      key={r.playerId}
                      className="flex items-center justify-between py-2 border-b border-gray-700"
                    >
                      <span className="text-sm flex items-center gap-1.5">
                        {r.playerIcon && <span className="text-base leading-none">{r.playerIcon}</span>}
                        {r.playerName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            r.isCorrect
                              ? 'bg-green-900 text-green-300'
                              : 'bg-red-900 text-red-300'
                          }`}
                        >
                          {r.isCorrect ? 'Correct' : 'Wrong'}
                        </span>
                        <span className="text-sm font-mono text-yellow-400">
                          +{r.pointsEarned}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-3">
                {hasNextQuestion ? (
                  <button
                    onClick={() => setPhase('between_questions')}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                  >
                    Next Question ({currentQuestionIndex + 1} of {totalQuestions})
                  </button>
                ) : (
                  <button
                    onClick={handleEndGame}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
                  >
                    {isSubmitting ? 'Ending…' : 'End Game'}
                  </button>
                )}
              </div>
            </div>

            <Leaderboard players={players} />
          </div>
        )}

        {/* ── COMPLETED ── */}
        {phase === 'completed' && (
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Game Over!</h2>
            <p className="text-gray-400 mb-6">Final Rankings</p>
            <div className="space-y-3 max-w-md mx-auto mb-8">
              {players.slice(0, 10).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    i === 0
                      ? 'bg-yellow-900 bg-opacity-50 border border-yellow-600'
                      : i === 1
                        ? 'bg-gray-700 border border-gray-500'
                        : i === 2
                          ? 'bg-orange-900 bg-opacity-30 border border-orange-700'
                          : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold w-8 text-center">
                      {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}.`}
                    </span>
                    <span className="font-medium flex items-center gap-1.5">
                      {p.playerIcon && <span className="text-lg leading-none">{p.playerIcon}</span>}
                      {p.playerName}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-yellow-400">
                    {p.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Leaderboard({
  players,
  compact = false,
}: {
  players: PubTriviaPlayer[];
  compact?: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const limit = compact ? 5 : sorted.length;

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
        Leaderboard
      </h2>
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-gray-500 text-sm">No players yet</p>
        ) : (
          sorted.slice(0, limit).map((p, i) => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm w-6 text-right">{i + 1}.</span>
                {p.playerIcon && <span className="text-base leading-none">{p.playerIcon}</span>}
                <span className="text-sm">{p.playerName}</span>
              </div>
              <span className="text-sm font-mono text-yellow-400">{p.score.toLocaleString()}</span>
            </div>
          ))
        )}
        {compact && sorted.length > limit && (
          <p className="text-xs text-gray-500 text-center pt-1">
            +{sorted.length - limit} more
          </p>
        )}
      </div>
    </div>
  );
}
