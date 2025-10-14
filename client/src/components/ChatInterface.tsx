import { useState, useRef, useEffect } from 'react';
import { useChat, type DirectChat, type OnlineUser, type ChatMessage } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Send, 
  Users, 
  MessageCircle, 
  Wifi, 
  WifiOff, 
  Circle,
  X,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterface({ isOpen, onClose }: ChatInterfaceProps) {
  const { user } = useAuth();
  const { 
    onlineUsers, 
    conversations, 
    unreadCount, 
    isConnected,
    typingUsers,
    incomingMessage,
    startConversation,
    sendMessage,
    getChatMessages,
    sendTypingIndicator,
    isSendingMessage
  } = useChat();

  const [selectedChat, setSelectedChat] = useState<DirectChat | null>(null);
  const [selectedUser, setSelectedUser] = useState<OnlineUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when a chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const chatMessages = await getChatMessages(selectedChat.id);
        // Merge with any messages that may have arrived via WebSocket during the fetch
        setMessages(prevMessages => {
          // Create a map of existing messages by ID
          const existingIds = new Set(prevMessages.map(m => m.id));
          
          // Add fetched messages that don't already exist
          const newMessages = chatMessages.filter((m: ChatMessage) => !existingIds.has(m.id));
          
          // Combine and sort by sentAt timestamp
          const combined = [...chatMessages, ...prevMessages.filter(m => !chatMessages.some((cm: ChatMessage) => cm.id === m.id))];
          combined.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          
          return combined;
        });
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChat, getChatMessages]);

  // Listen for incoming messages via WebSocket
  useEffect(() => {
    if (!incomingMessage) return;

    console.log('[ChatInterface] Incoming message:', incomingMessage, 'Selected chat:', selectedChat?.id);

    // Check if the incoming message belongs to the current chat
    if (selectedChat && incomingMessage.chatId === selectedChat.id) {
      console.log('[ChatInterface] Adding incoming message to current chat');
      // Add message if it doesn't already exist
      setMessages(prev => {
        const messageExists = prev.some(m => m.id === incomingMessage.id);
        if (messageExists) {
          console.log('[ChatInterface] Message already exists, skipping');
          return prev;
        }
        console.log('[ChatInterface] Adding new message to chat');
        return [...prev, incomingMessage];
      });
    } else {
      console.log('[ChatInterface] Message chat ID mismatch or no chat selected');
    }
  }, [incomingMessage, selectedChat?.id]);

  // Poll for new messages in the active conversation every 2 seconds
  useEffect(() => {
    if (!selectedChat) return;

    const interval = setInterval(async () => {
      try {
        const chatMessages = await getChatMessages(selectedChat.id);
        setMessages(prevMessages => {
          // Only update if there are new messages
          if (JSON.stringify(chatMessages) === JSON.stringify(prevMessages)) {
            return prevMessages;
          }
          return chatMessages;
        });
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [selectedChat, getChatMessages]);

  const handleStartChat = async (onlineUser: OnlineUser) => {
    try {
      const chat = await startConversation(onlineUser.id);
      
      // Create a DirectChat object from the response
      const directChat: DirectChat = {
        ...chat,
        otherUser: onlineUser,
      };
      
      setSelectedChat(directChat);
      setSelectedUser(onlineUser);
      setMessages([]);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleSelectConversation = (conversation: DirectChat) => {
    setSelectedChat(conversation);
    setSelectedUser(null); // Clear selected user since we're using existing conversation
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || !user) return;

    const toUserId = selectedChat.otherUser.id;
    const messageContent = messageInput.trim();

    // Clear input immediately for better UX
    setMessageInput('');

    try {
      await sendMessage({
        chatId: selectedChat.id,
        content: messageContent,
        toUserId,
      });

      // Stop typing indicator
      sendTypingIndicator(selectedChat.id, toUserId, false);
      
      // Note: The message will be added via WebSocket, no need for optimistic update
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message input on error
      setMessageInput(messageContent);
    }
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (!selectedChat) return;

    // Send typing indicator
    if (value.trim()) {
      sendTypingIndicator(selectedChat.id, selectedChat.otherUser.id, true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 1 second of no input
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(selectedChat.id, selectedChat.otherUser.id, false);
      }, 1000);
    } else {
      sendTypingIndicator(selectedChat.id, selectedChat.otherUser.id, false);
    }
  };

  const getUserDisplayName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.email) return user.email.split('@')[0];
    return 'Unknown User';
  };

  const getInitials = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) return user.firstName[0].toUpperCase();
    if (user.email) return user.email[0].toUpperCase();
    return 'U';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col" style={{ backgroundColor: '#0a1628', borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
        <CardHeader className="border-b flex-shrink-0" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" style={{ color: 'var(--terminal-text)' }} />
              <CardTitle style={{ color: 'var(--terminal-text)' }}>Chat System</CardTitle>
              {isConnected && (
                <div className="flex items-center space-x-1 text-sm">
                  <Wifi className="w-4 h-4" style={{ color: 'var(--terminal-text)' }} />
                  <span style={{ color: 'var(--terminal-text)' }}>Connected</span>
                </div>
              )}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="bg-red-600">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-opacity-10"
              style={{ color: 'var(--terminal-text)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--terminal-subtle-rgb), 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex overflow-hidden">
          {/* Left Panel - User List and Conversations */}
          <div className="w-1/3 border-r flex flex-col" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
            {/* Online Users */}
            <div className="p-4 border-b" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
              <div className="flex items-center space-x-2 mb-3">
                <Users className="w-4 h-4" style={{ color: 'var(--terminal-text)' }} />
                <h3 className="text-sm font-medium" style={{ color: 'var(--terminal-text)' }}>
                  Online Users ({onlineUsers.length})
                </h3>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {onlineUsers.filter(u => u.id !== user?.id).map((onlineUser) => (
                    <div
                      key={onlineUser.id}
                      onClick={() => handleStartChat(onlineUser)}
                      className="flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--terminal-subtle-rgb), 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="relative">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={onlineUser.profileImageUrl} />
                          <AvatarFallback className="text-xs" style={{ backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.2)', color: 'var(--terminal-text)' }}>
                            {getInitials(onlineUser)}
                          </AvatarFallback>
                        </Avatar>
                        <Circle className="w-2 h-2 fill-current absolute -bottom-0.5 -right-0.5" style={{ color: 'var(--terminal-text)' }} />
                      </div>
                      <span className="text-sm truncate" style={{ color: 'var(--terminal-text)' }}>
                        {getUserDisplayName(onlineUser)}
                      </span>
                    </div>
                  ))}
                  {onlineUsers.filter(u => u.id !== user?.id).length === 0 && (
                    <div className="text-xs text-center py-4" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                      No other users online
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Conversations */}
            <div className="flex-1 p-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--terminal-text)' }}>
                Recent Conversations ({conversations.length})
              </h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        "flex items-center space-x-2 p-3 rounded cursor-pointer transition-colors",
                        selectedChat?.id === conversation.id ? "border" : ""
                      )}
                      style={{
                        backgroundColor: selectedChat?.id === conversation.id 
                          ? 'rgba(var(--terminal-subtle-rgb), 0.2)' 
                          : 'transparent',
                        borderColor: selectedChat?.id === conversation.id 
                          ? 'rgba(var(--terminal-subtle-rgb), 0.5)' 
                          : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedChat?.id !== conversation.id) {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--terminal-subtle-rgb), 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedChat?.id !== conversation.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={conversation.otherUser.profileImageUrl} />
                        <AvatarFallback className="text-xs" style={{ backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.2)', color: 'var(--terminal-text)' }}>
                          {getInitials(conversation.otherUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate" style={{ color: 'var(--terminal-text)' }}>
                            {getUserDisplayName(conversation.otherUser)}
                          </span>
                          {conversation.lastMessage && (
                            <span className="text-xs" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                              {format(new Date(conversation.lastMessage.sentAt), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-xs truncate" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-xs text-center py-8" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                      No conversations yet. Start chatting with online users!
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Chat Window */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b flex items-center space-x-2" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedChat.otherUser.profileImageUrl} />
                    <AvatarFallback style={{ backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.2)', color: 'var(--terminal-text)' }}>
                      {getInitials(selectedChat.otherUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--terminal-text)' }}>
                      {getUserDisplayName(selectedChat.otherUser)}
                    </h3>
                    {typingUsers[selectedChat.otherUser.id] && (
                      <p className="text-xs" style={{ color: 'var(--terminal-text)' }}>typing...</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div style={{ color: 'var(--terminal-text)' }}>Loading messages...</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.fromUserId === user?.id ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm"
                            style={{
                              backgroundColor: message.fromUserId === user?.id
                                ? 'var(--terminal-highlight)'
                                : '#0d1a33',
                              color: message.fromUserId === user?.id
                                ? 'white'
                                : 'var(--terminal-text)',
                              border: message.fromUserId === user?.id
                                ? 'none'
                                : '1px solid rgba(var(--terminal-subtle-rgb), 0.3)'
                            }}
                          >
                            <p>{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {format(new Date(message.sentAt), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)' }}>
                  <div className="flex space-x-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      style={{ 
                        backgroundColor: '#060f1c', 
                        borderColor: 'rgba(var(--terminal-subtle-rgb), 0.3)', 
                        color: 'var(--terminal-text)'
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSendingMessage}
                      className="text-white"
                      style={{ backgroundColor: 'var(--terminal-highlight)' }}
                      onMouseEnter={(e) => {
                        if (!messageInput.trim() || isSendingMessage) return;
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* No Chat Selected */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--terminal-text)', opacity: 0.5 }} />
                  <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--terminal-text)' }}>
                    Select a conversation
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                    Choose an online user or existing conversation to start chatting
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
