/**
 * @fileoverview Hook for managing device_id for team authentication.
 *
 * Generates a unique device_id for each browser and stores it in localStorage.
 * This device_id is used to claim teams and verify team ownership in API requests.
 *
 * @module hooks/useDeviceId
 */

'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'reviewgame_device_id';

/**
 * Gets or generates a unique device_id for this browser.
 *
 * The device_id is stored in localStorage and persists across sessions.
 * Used to authenticate which team this device is controlling.
 *
 * @returns {string} The device_id for this browser
 */
export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Try to get existing device_id from localStorage
      let storedDeviceId: string | null = localStorage.getItem(DEVICE_ID_KEY);

      // If no device_id exists, generate a new one
      if (!storedDeviceId) {
        storedDeviceId = uuidv4();
        localStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
      }

      setDeviceId(storedDeviceId as string); // safe cast - always string after the check above
    } catch (error) {
      // localStorage might be disabled or full
      console.error('Failed to get/set device_id:', error);
      // Generate a session-only device_id
      setDeviceId(uuidv4());
    }
  }, []);

  return deviceId;
}

/**
 * Gets the device_id synchronously (for server-side or immediate access).
 *
 * Note: This only works in the browser. Returns null on server or if localStorage fails.
 *
 * @returns {string | null} The device_id or null
 */
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    let deviceId: string | null = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId as string; // safe cast - always string after the check above
  } catch (error) {
    console.error('Failed to get device_id:', error);
    return null;
  }
}
