import { useQuery } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import type { User, UserPreferences } from "@shared/schema";
import { SESSION_EXPIRED_EVENT } from "@/lib/queryClient";

interface AuthResponse {
  user: User | null;
  preferences: UserPreferences | null;
}

export function useAuth() {
  const hasShownExpiryWarning = useRef(false);
  
  const { data, isLoading, refetch } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // If session expired and should redirect, redirect to login
        if (errorData.shouldRedirect || errorData.shouldReauth) {
          console.log('Session expired, redirecting to login...');
          window.location.href = '/api/login';
        }
        
        throw new Error('Not authenticated');
      }
      
      // Reset warning flag on successful auth
      hasShownExpiryWarning.current = false;
      return response.json();
    },
  });

  // Handle session expiration events from API client
  const handleSessionExpired = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    
    // Prevent multiple warnings
    if (hasShownExpiryWarning.current) return;
    hasShownExpiryWarning.current = true;
    
    console.warn('Session expired event received, attempting to refresh auth state');
    
    // First try to refetch auth state - maybe the session is still valid
    refetch().then((result) => {
      if (result.data?.user) {
        // Session is still valid, reset warning flag
        hasShownExpiryWarning.current = false;
        console.log('Session still valid after refetch');
      } else if (customEvent.detail?.shouldReauth) {
        // Session is truly expired, redirect to login
        console.log('Session confirmed expired, redirecting to login...');
        window.location.href = '/api/login';
      }
    }).catch(() => {
      // Refetch failed, redirect to login
      console.log('Auth refetch failed, redirecting to login...');
      window.location.href = '/api/login';
    });
  }, [refetch]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [handleSessionExpired]);

  return {
    user: data?.user || null,
    preferences: data?.preferences || null,
    isLoading,
    isAuthenticated: !!data?.user,
    refetchAuth: refetch,
  };
}