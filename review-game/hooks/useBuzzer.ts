/**
 * @fileoverview Manages real-time buzzer functionality for game show interactions.
 *
 * This hook provides real-time buzzer capabilities using Supabase's broadcast feature,
 * enabling students to buzz in during questions and teachers to manage the buzz queue.
 * It also handles broadcasting question state changes across all connected clients.
 *
 * @module hooks/useBuzzer
 */

import { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/gameStore';
import { createClient } from '../lib/supabase/client';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import type { Question } from '../types/game';

/**
 * Represents a buzz event sent by a team.
 *
 * @interface BuzzEvent
 * @property {string} teamId - The unique identifier of the team that buzzed
 * @property {number} timestamp - The timestamp (milliseconds) when the buzz occurred
 */
interface BuzzEvent {
  teamId: string;
  timestamp: number;
}

/**
 * Payload structure for question selection broadcast events.
 *
 * @interface QuestionSelectedPayload
 * @property {Question} question - The question that was selected
 */
interface QuestionSelectedPayload {
  question: Question;
}

/**
 * Return type of the useBuzzer hook.
 *
 * @interface BuzzerHook
 * @property {function} sendBuzz - Function to send a buzz event for a team
 * @property {function} clearBuzzes - Function to clear all buzzes in the queue
 * @property {function} broadcastQuestionSelected - Function to broadcast a selected question to all clients
 * @property {function} broadcastQuestionClosed - Function to broadcast that the current question has been closed
 */
interface BuzzerHook {
  sendBuzz: (teamId: string) => void;
  clearBuzzes: () => void;
  broadcastQuestionSelected: (question: Question) => void;
  broadcastQuestionClosed: () => void;
}

/**
 * Custom hook for managing real-time buzzer functionality in a game.
 *
 * This hook:
 * - Establishes a Supabase Realtime channel for the specified game
 * - Listens for buzz events from students
 * - Listens for buzz queue clear events from teachers
 * - Listens for question selection/closure events to sync state
 * - Provides functions to send buzzes and broadcast game events
 * - Automatically cleans up subscriptions on unmount
 *
 * The hook uses refs to maintain stable channel connections and prevent race conditions
 * between subscription and broadcast operations.
 *
 * @param {string | undefined} gameId - The unique identifier of the game session
 * @returns {BuzzerHook} Object containing buzzer control functions
 *
 * @example
 * ```tsx
 * const { sendBuzz, clearBuzzes } = useBuzzer(gameId);
 *
 * // Student buzzes in
 * const handleBuzz = () => sendBuzz(teamId);
 *
 * // Teacher clears all buzzes
 * const handleClear = () => clearBuzzes();
 * ```
 */
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

  /**
   * Sends a buzz event for a specific team to all connected clients.
   *
   * This function broadcasts a buzz event through the Supabase Realtime channel
   * and immediately updates the local game store for responsive UI feedback.
   * The buzz includes a timestamp to ensure proper ordering in the queue.
   *
   * @param {string} teamId - The unique identifier of the team buzzing in
   *
   * @example
   * ```tsx
   * sendBuzz('team-abc-123');
   * ```
   */
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
    useGameStore.getState().addBuzz(teamId, timestamp);
  };

  /**
   * Clears all buzzes from the buzz queue across all connected clients.
   *
   * This function broadcasts a clear-buzzes event through the Supabase Realtime
   * channel and immediately clears the local buzz queue. Typically called by
   * teachers after acknowledging buzzes or when starting a new question.
   *
   * @example
   * ```tsx
   * clearBuzzes(); // All buzzes cleared
   * ```
   */
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
    useGameStore.getState().clearBuzzQueue();
  };

  /**
   * Broadcasts a question selection event to synchronize state across all clients.
   *
   * This function notifies all connected clients (students, teachers, and display boards)
   * that a question has been selected. The question data is validated before broadcasting
   * to ensure data integrity.
   *
   * @param {Question} question - The question object that was selected
   *
   * @example
   * ```tsx
   * broadcastQuestionSelected({
   *   id: 'q-123',
   *   text: 'What is the capital of France?',
   *   value: 200,
   *   isUsed: false
   * });
   * ```
   */
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

  /**
   * Broadcasts a question closed event to clear current question state across all clients.
   *
   * This function notifies all connected clients that the current question has been
   * answered or dismissed, clearing the question from the UI across all views.
   *
   * @example
   * ```tsx
   * broadcastQuestionClosed(); // Clears current question on all clients
   * ```
   */
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