import { useQuery } from "@tanstack/react-query";
import type { Conversation } from "@shared/schema";

export function useConversationHistory() {
  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/user/conversations"],
    retry: false,
  });

  return {
    conversations: conversations || [],
    isLoading,
  };
}