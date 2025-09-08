import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

export interface ChatMessage {
  id: string;
  chatId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  isRead: boolean;
  isDelivered: boolean;
  sentAt: string;
  readAt?: string;
}

export interface DirectChat {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  otherUser: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
  lastMessage?: ChatMessage;
}

export interface OnlineUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  presence: {
    id: string;
    userId: string;
    isOnline: boolean;
    lastSeen: string;
    status: string;
  };
}

export const useChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});

  // Fetch online users
  const { data: onlineUsers = [], refetch: refetchOnlineUsers } = useQuery({
    queryKey: ['/api/chat/online-users'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch user's direct chats
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['/api/chat/conversations'],
    enabled: !!user,
  });

  // Fetch unread message count
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['/api/chat/unread-count'],
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const unreadCount = (unreadData as { count: number })?.count || 0;

  // Start a new conversation
  const startConversationMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      const response = await apiRequest('POST', '/api/chat/conversations', { otherUserId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    },
  });

  // Send a message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content, toUserId }: { 
      chatId: string; 
      content: string; 
      toUserId: string; 
    }) => {
      const response = await apiRequest('POST', '/api/chat/messages', { chatId, content, toUserId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      refetchUnreadCount();
    },
  });

  // Mark message as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('PUT', `/api/chat/messages/${messageId}/read`);
    },
    onSuccess: () => {
      refetchUnreadCount();
    },
  });

  // Get messages for a specific chat
  const getChatMessages = useCallback(async (chatId: string, limit = 50) => {
    const response = await apiRequest('GET', `/api/chat/conversations/${chatId}/messages?limit=${limit}`);
    return await response.json();
  }, []);

  // WebSocket connection management
  useEffect(() => {
    if (!user?.id) return;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Chat WebSocket connected');
        setIsConnected(true);
        
        // Authenticate with the server
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          userId: user.id,
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'message':
              // New message received
              queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
              refetchUnreadCount();
              break;
              
            case 'user_online':
              // User came online
              refetchOnlineUsers();
              break;
              
            case 'user_offline':
              // User went offline
              refetchOnlineUsers();
              break;
              
            case 'typing':
              // Handle typing indicators
              const { fromUserId, isTyping } = message.data;
              setTypingUsers(prev => ({
                ...prev,
                [fromUserId]: isTyping,
              }));
              
              // Clear typing indicator after 3 seconds
              if (isTyping) {
                setTimeout(() => {
                  setTypingUsers(prev => ({
                    ...prev,
                    [fromUserId]: false,
                  }));
                }, 3000);
              }
              break;
              
            case 'auth_success':
              console.log('Chat authentication successful');
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Chat WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('Chat WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id, queryClient, refetchOnlineUsers, refetchUnreadCount]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((chatId: string, toUserId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        chatId,
        toUserId,
        isTyping,
      }));
    }
  }, []);

  return {
    // Data
    onlineUsers: onlineUsers as OnlineUser[],
    conversations: conversations as DirectChat[],
    unreadCount,
    isConnected,
    typingUsers,

    // Actions
    startConversation: startConversationMutation.mutateAsync,
    sendMessage: sendMessageMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    getChatMessages,
    sendTypingIndicator,

    // Loading states
    isStartingConversation: startConversationMutation.isPending,
    isSendingMessage: sendMessageMutation.isPending,

    // Refetch functions
    refetchOnlineUsers,
    refetchConversations,
    refetchUnreadCount,
  };
};