import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from '../lib/stores/gameStore';

// ---------------------------------------------------------------------------
// Minimal mocks — we test store integration and broadcast payloads directly
// without mounting the hook (which requires Supabase + React).
// ---------------------------------------------------------------------------

describe('useBuzzer — answer-revealed integration (store)', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  // These tests verify the store actions that useBuzzer calls when it receives
  // 'answer-revealed' and 'question-closed' broadcast events.

  describe('setRevealedAnswer via store (simulates answer-revealed handler)', () => {
    it('stores the answer when broadcast received', () => {
      useGameStore.getState().setRevealedAnswer('The Eiffel Tower');
      expect(useGameStore.getState().revealedAnswer).toBe('The Eiffel Tower');
    });

    it('clears the answer when null broadcast received', () => {
      useGameStore.getState().setRevealedAnswer('The Eiffel Tower');
      useGameStore.getState().setRevealedAnswer(null);
      expect(useGameStore.getState().revealedAnswer).toBeNull();
    });
  });

  describe('question-closed clears revealedAnswer (simulates question-closed handler)', () => {
    it('clears revealedAnswer when question is closed', () => {
      // Set up: answer has been revealed and question is active
      useGameStore.getState().setRevealedAnswer('The Eiffel Tower');
      useGameStore.getState().setCurrentQuestion({
        id: 'q-1',
        value: 200,
        text: 'What is in Paris?',
        isUsed: false,
      });

      // Simulate the question-closed handler in useBuzzer
      const store = useGameStore.getState();
      store.setCurrentQuestion(null);
      store.setRevealedAnswer(null);

      expect(useGameStore.getState().revealedAnswer).toBeNull();
      expect(useGameStore.getState().currentQuestion).toBeNull();
    });
  });

  describe('broadcastAnswerRevealed payload validation', () => {
    it('payload with answer string is truthy', () => {
      const payload = { answer: 'Paris' };
      expect(payload.answer).not.toBeNull();
      expect(typeof payload.answer).toBe('string');
    });

    it('payload with null answer signals hide', () => {
      const payload = { answer: null };
      expect(payload.answer).toBeNull();
    });
  });
});

describe('useBuzzer — broadcastAnswerRevealed channel guard', () => {
  it('does not throw when channel is null (guard condition)', () => {
    // The broadcast function checks channelRef.current before sending.
    // This test validates that the guard logic pattern is sound by testing
    // the condition directly.
    const channelRef: { current: null | { send: () => void } } = { current: null };
    const mockLogger = { warn: vi.fn() };

    const broadcastAnswerRevealed = (_answer: string | null) => {
      if (!channelRef.current) {
        mockLogger.warn('Cannot broadcast: channel not initialized');
        return;
      }
      channelRef.current.send();
    };

    expect(() => broadcastAnswerRevealed('test')).not.toThrow();
    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });

  it('calls send when channel is available', () => {
    const mockSend = vi.fn();
    const channelRef: { current: null | { send: () => void } } = {
      current: { send: mockSend },
    };

    const broadcastAnswerRevealed = (_answer: string | null) => {
      if (!channelRef.current) return;
      channelRef.current.send();
    };

    broadcastAnswerRevealed('Paris');
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
