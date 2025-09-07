import { useQuery } from "@tanstack/react-query";
import type { User, UserPreferences } from "@shared/schema";

interface AuthResponse {
  user: User | null;
  preferences: UserPreferences | null;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include', // Include cookies for session auth
      });
      
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      
      return response.json();
    },
  });

  return {
    user: data?.user || null,
    preferences: data?.preferences || null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}