import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { resetSessionErrorCount, SESSION_EXPIRED_EVENT } from '@/lib/queryClient';

const HEARTBEAT_INTERVAL = 10 * 60 * 1000; // 10 minutes - more frequent to stay within 30-min proactive refresh window
const MIN_HEARTBEAT_GAP = 30 * 1000; // Minimum 30 seconds between heartbeats to prevent spamming

export function useSessionKeepAlive() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);

  const sendHeartbeat = useCallback(async (force: boolean = false) => {
    // Skip if not enough time has passed since last heartbeat (unless forced)
    const now = Date.now();
    if (!force && now - lastHeartbeatRef.current < MIN_HEARTBEAT_GAP) {
      return;
    }

    // Skip regular heartbeats if page is hidden (but not forced ones from visibility change)
    if (!force && document.hidden) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/heartbeat?t=${now}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.ok) {
        // Only update timestamp on success to allow immediate retries on failure
        lastHeartbeatRef.current = Date.now();
        retryCountRef.current = 0;
        // Reset global 401 counter since session is healthy
        resetSessionErrorCount();
      } else if (response.status === 401) {
        // Session expired - trigger re-auth via event
        console.warn('Session expired during heartbeat (401)');
        retryCountRef.current++;
        
        // Dispatch session expired event for auth hook to handle
        if (retryCountRef.current >= 2) {
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: { shouldReauth: true, source: 'heartbeat' }
          }));
        }
      }
    } catch (error) {
      retryCountRef.current++;
      console.debug('Heartbeat network error (attempt', retryCountRef.current, '):', error);
      // Don't update lastHeartbeatRef on failure - allow immediate retry
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Handle visibility change - send heartbeat immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible - send immediate heartbeat to refresh token if needed
        console.debug('Tab became visible, sending heartbeat');
        sendHeartbeat(true);
      }
    };

    // Handle focus - also send heartbeat when window regains focus
    const handleFocus = () => {
      console.debug('Window focused, sending heartbeat');
      sendHeartbeat(true);
    };

    // Send initial heartbeat
    sendHeartbeat(true);

    // Set up interval for periodic heartbeats
    intervalRef.current = window.setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);

    // Add visibility and focus listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, sendHeartbeat]);
}
