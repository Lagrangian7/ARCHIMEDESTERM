import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

const HEARTBEAT_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds

export function useSessionKeepAlive() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Only start heartbeat if user is authenticated
    if (!user) {
      return;
    }

    const sendHeartbeat = async () => {
      // Skip heartbeat if page is hidden (tab not active)
      if (document.hidden) {
        return;
      }

      try {
        // Add cache-busting to ensure token refresh happens
        await fetch(`/api/auth/heartbeat?t=${Date.now()}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store', // Prevent browser from caching the response
        });
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('Heartbeat failed:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for periodic heartbeats
    intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or when user changes
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user]);

  // No return value needed - this hook just maintains the session
}
