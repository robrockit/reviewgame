import { useEffect, useRef } from 'react';
import { useGameStore } from '../lib/stores/gameStore';
import { createClient } from '../lib/supabase/client';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Define the structure of a buzz event
interface BuzzEvent {
  teamId: string;
  timestamp: number;
}

// Define the structure of the hook's return value
interface BuzzerHook {
  sendBuzz: (teamId: string) => void;
  clearBuzzes: () => void;
}

export const useBuzzer = (gameId: string | undefined): BuzzerHook => {
  const { addBuzz, clearBuzzQueue } = useGameStore();

  // Store the Supabase client in a ref so it can be accessed across renders
  // and in functions outside the useEffect scope
  const supabaseClientRef = useRef<SupabaseClient | null>(null);

  // Store the channel reference to ensure we use the same subscribed channel
  // for both receiving and sending events (prevents race conditions)
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initialize the client on first render
  if (supabaseClientRef.current === null) {
    supabaseClientRef.current = createClient();
  }

  useEffect(() => {
    if (!gameId || !supabaseClientRef.current) {
      console.warn('useBuzzer: gameId is not provided, not subscribing to channel.');
      return;
    }

    const channelName = `game:${gameId}`;
    const channel = supabaseClientRef.current.channel(channelName);

    // Store channel reference for use in sendBuzz/clearBuzzes
    channelRef.current = channel;

    // Subscribe to 'buzz' events
    channel.on('broadcast', { event: 'buzz' }, ({ payload }: { payload: BuzzEvent }) => {
      const buzzEvent: BuzzEvent = payload;
      // Add buzz to the store, ensuring it's sorted by timestamp
      addBuzz(buzzEvent.teamId, buzzEvent.timestamp);
    });

    // Subscribe to 'clear-buzzes' events
    channel.on('broadcast', { event: 'clear-buzzes' }, () => {
      clearBuzzQueue();
    });

    // Subscribe to 'score-update' events (optional for this task, but mentioned)
    // channel.on('broadcast', { event: 'score-update' }, ({ payload }) => {
    //   // Handle score updates if needed by the hook
    // });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Error subscribing to channel: ${channelName}`);
      }
    });

    // Cleanup subscription on component unmount
    return () => {
      if (supabaseClientRef.current) {
        supabaseClientRef.current.removeChannel(channel);
        console.log(`Unsubscribed from channel: ${channelName}`);
      }
      // Clear the channel ref
      channelRef.current = null;
    };
  }, [gameId, addBuzz, clearBuzzQueue]); // Dependencies for useEffect

  const sendBuzz = (teamId: string) => {
    if (!gameId || !channelRef.current) {
      console.warn('useBuzzer: Cannot send buzz, gameId is not provided or channel not initialized.');
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
    if (!gameId || !channelRef.current) {
      console.warn('useBuzzer: Cannot clear buzzes, gameId is not provided or channel not initialized.');
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

  return {
    sendBuzz,
    clearBuzzes,
  };
};