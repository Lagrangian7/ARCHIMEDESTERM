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

export const useChat = (options?: { enableWebSocket?: boolean }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [incomingMessage, setIncomingMessage] = useState<ChatMessage | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const enableWebSocket = options?.enableWebSocket ?? true;

  // Enable chat queries when user is authenticated
  const { data: onlineUsers = [], refetch: refetchOnlineUsers } = useQuery({
    queryKey: ['/api/chat/online-users'],
    enabled: !!user,
    staleTime: 30000,
  });

  // Fetch user's direct chats
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['/api/chat/conversations'],
    enabled: !!user,
    staleTime: 30000,
  });

  // Fetch unread message count
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['/api/chat/unread-count'],
    enabled: !!user,
    staleTime: 10000,
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

  // Poll for new messages only when chat interface is actually open
  useEffect(() => {
    // Don't poll if WebSocket is disabled or user isn't authenticated
    if (!enableWebSocket || !user?.id) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      refetchUnreadCount();
    }, 5000); // Reduced frequency to 5 seconds
    
    return () => clearInterval(interval);
  }, [enableWebSocket, queryClient, refetchUnreadCount, user?.id]);

  // WebSocket connection management with improved reliability
  useEffect(() => {
    // Only connect if user is authenticated and WebSocket is enabled
    if (!user?.id || !enableWebSocket) return;

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout;
    let isConnecting = false;

    const connectWebSocket = () => {
      if (isConnecting) return;
      
      isConnecting = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
      
      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          // Clear any pending disconnect timeout
          if (disconnectTimeoutRef.current) {
            clearTimeout(disconnectTimeoutRef.current);
          }
          
          setIsConnected(true);
          reconnectAttempts = 0; // Reset on successful connection
          isConnecting = false;
          
          // Authenticate with the server - add small delay to ensure connection is fully established
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const authMessage = JSON.stringify({
                type: 'auth',
                userId: user?.id,
              });
              wsRef.current.send(authMessage);
            }
          }, 50); // 50ms delay
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'message':
                // New message received
                setIncomingMessage(message.data);
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
                // Authentication successful, connection ready
                break;
                
              case 'error':
                // Handle server error gracefully
                break;
                
              default:
                // Unknown message type, ignore silently
            }
          } catch (error) {
            // Error parsing message, ignore silently
          }
        };

        wsRef.current.onclose = (event) => {
          isConnecting = false;
          
          // Delay showing "Disconnected" status to avoid flashing during brief reconnections
          disconnectTimeoutRef.current = setTimeout(() => {
            setIsConnected(false);
          }, 2000); // Wait 2 seconds before showing as disconnected
          
          // Only attempt to reconnect if it wasn't a manual close (code 1000)
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
            
            reconnectTimeout = setTimeout(connectWebSocket, backoffTime);
          }
        };

        wsRef.current.onerror = (error) => {
          setIsConnected(false);
          isConnecting = false;
        };
      } catch (error) {
        isConnecting = false;
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Component unmounting'); // Normal closure
      }
    };
  }, [user?.id, enableWebSocket]);

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
    incomingMessage,

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