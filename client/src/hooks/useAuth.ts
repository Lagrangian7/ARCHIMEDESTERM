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
  });

  return {
    user: data?.user || null,
    preferences: data?.preferences || null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}