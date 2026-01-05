import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UserPreferences, InsertUserPreferences } from "@shared/schema";

export function useUserPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    retry: false,
  });

  // Sync defaultMode preference with localStorage and dispatch event for same-tab listeners
  useEffect(() => {
    if (preferences?.defaultMode) {
      localStorage.setItem('ai-mode', preferences.defaultMode);
      // Dispatch custom event for same-tab mode sync (storage event only fires for other tabs)
      window.dispatchEvent(new CustomEvent('ai-mode-change', { 
        detail: { mode: preferences.defaultMode } 
      }));
    }
  }, [preferences?.defaultMode]);

  // Sync pythonIdeTheme preference with localStorage and dispatch event for same-tab listeners
  useEffect(() => {
    if (preferences?.pythonIdeTheme) {
      localStorage.setItem('python-ide-theme', preferences.pythonIdeTheme);
      // Dispatch custom event for Python IDE theme sync
      window.dispatchEvent(new CustomEvent('python-ide-theme-change', { 
        detail: { theme: preferences.pythonIdeTheme } 
      }));
    }
  }, [preferences?.pythonIdeTheme]);

  // Sync terminalTheme preference with localStorage and dispatch event for same-tab listeners
  useEffect(() => {
    if (preferences?.terminalTheme) {
      localStorage.setItem('terminal-theme', preferences.terminalTheme);
      // Dispatch custom event for terminal theme sync
      window.dispatchEvent(new CustomEvent('terminal-theme-change', { 
        detail: { theme: preferences.terminalTheme } 
      }));
    }
  }, [preferences?.terminalTheme]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<InsertUserPreferences>) => {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update preferences");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    isUpdating: updatePreferencesMutation.isPending,
  };
}