import { useEffect, useRef } from 'react';
import { createClient } from '../lib/supabase/client';
import { usePubTriviaStore } from '../lib/stores/pubTriviaStore';
import { logger } from '../lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  PubTriviaQuestionForPlayer,
  PubTriviaRoundResult,
  PubTriviaPlayer,
  PtQuestionStartedEvent,
  PtOptionEliminatedEvent,
  PtAllAnsweredEvent,
  PtQuestionEndedEvent,
  PtGameEndedEvent,
} from '../types/pub-trivia';

const CHANNEL_PREFIX = 'pub-trivia';

export function usePubTrivia(gameId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const store = usePubTriviaStore();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`${CHANNEL_PREFIX}:${gameId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'pt_question_started' }, ({ payload }: { payload: PtQuestionStartedEvent['payload'] }) => {
        store.startQuestion({
          questionIndex: payload.questionIndex,
          question: payload.question,
          startedAt: payload.startedAt,
        });
      })
      .on('broadcast', { event: 'pt_option_eliminated' }, ({ payload }: { payload: PtOptionEliminatedEvent['payload'] }) => {
        store.eliminateOption(payload.eliminatedIndex);
      })
      .on('broadcast', { event: 'pt_all_answered' }, () => {
        // No state change needed; teacher UI uses this to enable "End Round" early.
      })
      .on('broadcast', { event: 'pt_question_ended' }, ({ payload }: { payload: PtQuestionEndedEvent['payload'] }) => {
        store.endRound(payload.correctAnswer, payload.results);
        // Update individual player scores from results
        payload.results.forEach((r) => {
          if (r.pointsEarned > 0) {
            const player = usePubTriviaStore.getState().players.find((p) => p.id === r.playerId);
            if (player) {
              store.updatePlayerScore(r.playerId, player.score + r.pointsEarned);
            }
          }
        });
      })
      .on('broadcast', { event: 'pt_game_ended' }, ({ payload }: { payload: PtGameEndedEvent['payload'] }) => {
        store.endGame(payload.finalRankings);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Pub trivia channel subscribed', { operation: 'usePubTrivia', gameId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // gameId is stable for the lifetime of the component — intentional single-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // ─── Teacher broadcast helpers ─────────────────────────────────────────────

  function broadcastQuestionStarted(
    questionIndex: number,
    question: PubTriviaQuestionForPlayer,
    durationMs: number,
    startedAt: number
  ): void {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pt_question_started',
      payload: { questionIndex, question, durationMs, startedAt } satisfies PtQuestionStartedEvent['payload'],
    });
  }

  function broadcastOptionEliminated(eliminatedIndex: number): void {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pt_option_eliminated',
      payload: { eliminatedIndex } satisfies PtOptionEliminatedEvent['payload'],
    });
  }

  function broadcastAllAnswered(playerCount: number): void {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pt_all_answered',
      payload: { playerCount } satisfies PtAllAnsweredEvent['payload'],
    });
  }

  function broadcastQuestionEnded(
    correctAnswer: string,
    results: PubTriviaRoundResult[]
  ): void {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pt_question_ended',
      payload: { correctAnswer, results } satisfies PtQuestionEndedEvent['payload'],
    });
  }

  function broadcastGameEnded(finalRankings: PubTriviaPlayer[]): void {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'pt_game_ended',
      payload: { finalRankings } satisfies PtGameEndedEvent['payload'],
    });
  }

  return {
    broadcastQuestionStarted,
    broadcastOptionEliminated,
    broadcastAllAnswered,
    broadcastQuestionEnded,
    broadcastGameEnded,
  };
}
