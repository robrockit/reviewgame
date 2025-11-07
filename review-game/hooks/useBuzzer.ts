import { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/gameStore';
import { createClient } from '../lib/supabase/client';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import type { Question } from '../types/game';

// Define the structure of a buzz event
interface BuzzEvent {
  teamId: string;
  timestamp: number;
}

// Define the structure of broadcast payloads
interface QuestionSelectedPayload {
  question: Question;
}

// Define the structure of the hook's return value
interface BuzzerHook {
  sendBuzz: (teamId: string) => void;
  clearBuzzes: () => void;
  broadcastQuestionSelected: (question: Question) => void;
  broadcastQuestionClosed: () => void;
}

export const useBuzzer = (gameId: string | undefined): BuzzerHook => {
  // Store the Supabase client in a ref so it can be accessed across renders
  // and in functions outside the useEffect scope
  const supabaseClientRef = useRef<SupabaseClient | null>(null);

  // Store the channel reference to ensure we use the same subscribed channel
  // for both receiving and sending events (prevents race conditions)
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Initialize the client on first render
  if (supabaseClientRef.current === null) {
    supabaseClientRef.current = createClient();
  }

  useEffect(() => {
    // Ensure gameId is a valid non-empty string before subscribing
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '' || !supabaseClientRef.current) {
      if (gameId !== undefined) {
        logger.warn('Buzzer hook: invalid or empty gameId, skipping channel subscription', {
          gameId,
          gameIdType: typeof gameId,
          operation: 'subscribeToChannel',
        });
      }
      return;
    }

    // Use a unique channel name for buzzer events to avoid conflicts with other channels
    const channelName = `buzzer:${gameId}`;
    // Configure channel with broadcast enabled and self-receive set to true
    // This allows clients to receive their own broadcast messages
    const channel = supabaseClientRef.current.channel(channelName, {
      config: {
        broadcast: {
          self: true, // Allow receiving own broadcasts for immediate local feedback
        },
      },
    });

    // Store channel reference for use in sendBuzz/clearBuzzes
    channelRef.current = channel;

    // Subscribe to 'buzz' events
    channel.on('broadcast', { event: 'buzz' }, ({ payload }: { payload: BuzzEvent }) => {
      // Prevent state updates if component has unmounted
      if (!isMountedRef.current) return;

      const buzzEvent: BuzzEvent = payload;
      // Add buzz to the store using getState() for consistency
      useGameStore.getState().addBuzz(buzzEvent.teamId, buzzEvent.timestamp);
    });

    // Subscribe to 'clear-buzzes' events
    channel.on('broadcast', { event: 'clear-buzzes' }, () => {
      // Prevent state updates if component has unmounted
      if (!isMountedRef.current) return;

      useGameStore.getState().clearBuzzQueue();
    });

    // Subscribe to 'question-selected' events to sync question state across all clients
    channel.on('broadcast', { event: 'question-selected' }, ({ payload }: { payload: QuestionSelectedPayload }) => {
      // Prevent state updates if component has unmounted
      if (!isMountedRef.current) return;

      // Comprehensive payload validation
      if (!payload ||
          !payload.question ||
          typeof payload.question.id !== 'string' ||
          typeof payload.question.value !== 'number' ||
          typeof payload.question.text !== 'string' ||
          typeof payload.question.isUsed !== 'boolean') {
        logger.warn('Received invalid question-selected payload', {
          gameId,
          payload,
          operation: 'questionSelectedHandler',
        });
        return;
      }

      useGameStore.getState().setCurrentQuestion(payload.question);
    });

    // Subscribe to 'question-closed' events to clear question state
    channel.on('broadcast', { event: 'question-closed' }, () => {
      // Prevent state updates if component has unmounted
      if (!isMountedRef.current) return;

      useGameStore.getState().setCurrentQuestion(null);
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Subscribed to buzzer channel', {
          gameId,
          channelName,
          operation: 'subscribeToChannel',
        });
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('Failed to subscribe to buzzer channel', undefined, {
          gameId,
          channelName,
          status,
          operation: 'subscribeToChannel',
        });
      }
    });

    // Cleanup subscription on component unmount
    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      if (supabaseClientRef.current) {
        supabaseClientRef.current.removeChannel(channel);
        logger.info('Unsubscribed from buzzer channel', {
          gameId,
          channelName,
          operation: 'unsubscribeFromChannel',
        });
      }
      // Clear the channel ref
      channelRef.current = null;
    };
  }, [gameId]); // Only gameId dependency since we use getState() in handlers

  const sendBuzz = (teamId: string) => {
    // Validate gameId and channel before sending
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '' || !channelRef.current) {
      logger.warn('Cannot send buzz: invalid gameId or channel not initialized', {
        gameId,
        teamId,
        channelInitialized: !!channelRef.current,
        operation: 'sendBuzz',
      });
      return;
    }

    const timestamp = Date.now();
    const buzzEvent: BuzzEvent = { teamId, timestamp };

    // Broadcast the buzz event using the stored channel reference
    // This ensures we use the same subscribed channel, preventing race conditions
    channelRef.current.send({
      type: 'broadcast',
      event: 'buzz',
      payload: buzzEvent,
    });

    // Also update the local store immediately for responsiveness
    addBuzz(teamId, timestamp);
  };

  const clearBuzzes = () => {
    // Validate gameId and channel before clearing
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '' || !channelRef.current) {
      logger.warn('Cannot clear buzzes: invalid gameId or channel not initialized', {
        gameId,
        channelInitialized: !!channelRef.current,
        operation: 'clearBuzzes',
      });
      return;
    }

    // Broadcast the clear-buzzes event using the stored channel reference
    channelRef.current.send({
      type: 'broadcast',
      event: 'clear-buzzes',
      payload: {}, // No payload needed for clear-buzzes
    });

    // Clear the local buzz queue immediately
    clearBuzzQueue();
  };

  const broadcastQuestionSelected = (question: Question) => {
    // Validate gameId and channel before broadcasting
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '' || !channelRef.current) {
      logger.warn('Cannot broadcast question selection: invalid gameId or channel not initialized', {
        gameId,
        channelInitialized: !!channelRef.current,
        operation: 'broadcastQuestionSelected',
      });
      return;
    }

    // Validate question object structure
    if (!question || typeof question.id !== 'string' || !question.id) {
      logger.warn('Invalid question object provided to broadcast', {
        gameId,
        question,
        operation: 'broadcastQuestionSelected',
      });
      return;
    }

    // Broadcast the question-selected event with error handling
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'question-selected',
        payload: { question },
      });

      logger.info('Broadcasted question selection', {
        gameId,
        questionId: question.id,
        operation: 'broadcastQuestionSelected',
      });
    } catch (error) {
      logger.error('Exception while broadcasting question selection', error, {
        gameId,
        questionId: question.id,
        operation: 'broadcastQuestionSelected',
      });
    }
  };

  const broadcastQuestionClosed = () => {
    // Validate gameId and channel before broadcasting
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '' || !channelRef.current) {
      logger.warn('Cannot broadcast question closed: invalid gameId or channel not initialized', {
        gameId,
        channelInitialized: !!channelRef.current,
        operation: 'broadcastQuestionClosed',
      });
      return;
    }

    // Broadcast the question-closed event with error handling
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'question-closed',
        payload: {},
      });

      logger.info('Broadcasted question closed', {
        gameId,
        operation: 'broadcastQuestionClosed',
      });
    } catch (error) {
      logger.error('Exception while broadcasting question closed', error, {
        gameId,
        operation: 'broadcastQuestionClosed',
      });
    }
  };

  return {
    sendBuzz,
    clearBuzzes,
    broadcastQuestionSelected,
    broadcastQuestionClosed,
  };
};