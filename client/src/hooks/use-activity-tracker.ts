import { useState, useEffect, useCallback, useRef } from 'react';

interface ActivityTrackerOptions {
  inactivityTimeout: number; // in milliseconds
  onInactive?: () => void;
  onActive?: () => void;
}

export function useActivityTracker(options: ActivityTrackerOptions) {
  const [isActive, setIsActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);

    if (!isActiveRef.current) {
      setIsActive(true);
      isActiveRef.current = true;
      options.onActive?.();
    }

    // Clear existing timeout and set a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
      isActiveRef.current = false;
      options.onInactive?.();
    }, options.inactivityTimeout);
  }, [options]);

  useEffect(() => {
    // List of events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
      'focus',
      'blur'
    ];

    // Throttle activity detection to prevent excessive calls
    let lastActivityTime = 0;
    const throttleDelay = 1000; // 1 second throttle

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime >= throttleDelay) {
        lastActivityTime = now;
        resetActivity();
      }
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Set initial timeout
    resetActivity();

    // Cleanup function
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetActivity]);

  // Force reset activity (useful for manual triggers)
  const forceActive = useCallback(() => {
    resetActivity();
  }, [resetActivity]);

  return {
    isActive,
    lastActivity,
    forceActive,
    timeUntilInactive: Math.max(0, options.inactivityTimeout - (Date.now() - lastActivity))
  };
}