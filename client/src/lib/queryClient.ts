import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Track 401 errors with timeout-based reset to detect real session expiration
let recent401Count = 0;
let last401Time = 0;
const MAX_401_BEFORE_REAUTH = 3;
const RESET_WINDOW_MS = 60 * 1000; // Reset counter after 1 minute of no 401s

// Custom event for session expiration
export const SESSION_EXPIRED_EVENT = 'session-expired';

// Reset the 401 counter (call this from heartbeat on success)
export function resetSessionErrorCount() {
  recent401Count = 0;
  last401Time = 0;
}

function handlePotentialSessionExpiry(res: Response, url?: string) {
  const now = Date.now();
  
  // Skip heartbeat endpoint - it handles its own 401 tracking
  if (url?.includes('/api/auth/heartbeat')) {
    if (res.ok) {
      resetSessionErrorCount();
    }
    return;
  }
  
  if (res.status === 401) {
    // Reset if enough time has passed since last 401 (likely recovered session)
    if (now - last401Time > RESET_WINDOW_MS) {
      recent401Count = 0;
    }
    
    recent401Count++;
    last401Time = now;
    
    // After multiple 401s within the time window, session is likely expired
    if (recent401Count >= MAX_401_BEFORE_REAUTH) {
      console.warn('Multiple 401 errors detected, session may have expired');
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
        detail: { shouldReauth: true, source: 'api' }
      }));
    }
  } else if (res.ok) {
    // Reset counter on successful requests
    resetSessionErrorCount();
  }
}

async function throwIfResNotOk(res: Response, url?: string) {
  handlePotentialSessionExpiry(res, url);
  
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res, url);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    // Track session expiry only once (not in throwIfResNotOk for queries)
    handlePotentialSessionExpiry(res, url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Don't call throwIfResNotOk which would double-count 401s
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
