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
        setMessages(chatMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
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

    try {
      await sendMessage({
        chatId: selectedChat.id,
        content: messageInput.trim(),
        toUserId,
      });

      // Add message to local state immediately for better UX
      const newMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        chatId: selectedChat.id,
        fromUserId: user.id,
        toUserId,
        content: messageInput.trim(),
        messageType: 'text',
        isRead: false,
        isDelivered: false,
        sentAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, newMessage]);
      setMessageInput('');

      // Stop typing indicator
      sendTypingIndicator(selectedChat.id, toUserId, false);
    } catch (error) {
      console.error('Error sending message:', error);
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
      <Card className="w-full max-w-6xl h-[80vh] bg-gray-900 border-green-500/30 flex flex-col">
        <CardHeader className="border-b border-green-500/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <CardTitle className="text-green-500">Chat System</CardTitle>
              <div className="flex items-center space-x-1 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-red-400">Disconnected</span>
                  </>
                )}
              </div>
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
              className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex overflow-hidden">
          {/* Left Panel - User List and Conversations */}
          <div className="w-1/3 border-r border-green-500/30 flex flex-col">
            {/* Online Users */}
            <div className="p-4 border-b border-green-500/30">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-medium text-green-500">
                  Online Users ({onlineUsers.length})
                </h3>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {onlineUsers.filter(u => u.id !== user?.id).map((onlineUser) => (
                    <div
                      key={onlineUser.id}
                      onClick={() => handleStartChat(onlineUser)}
                      className="flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-green-500/10 transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={onlineUser.profileImageUrl} />
                          <AvatarFallback className="bg-green-500/20 text-green-500 text-xs">
                            {getInitials(onlineUser)}
                          </AvatarFallback>
                        </Avatar>
                        <Circle className="w-2 h-2 text-green-500 fill-current absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <span className="text-sm text-green-400 truncate">
                        {getUserDisplayName(onlineUser)}
                      </span>
                    </div>
                  ))}
                  {onlineUsers.filter(u => u.id !== user?.id).length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      No other users online
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Conversations */}
            <div className="flex-1 p-4">
              <h3 className="text-sm font-medium text-green-500 mb-3">
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
                        selectedChat?.id === conversation.id
                          ? "bg-green-500/20 border border-green-500/50"
                          : "hover:bg-green-500/10"
                      )}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={conversation.otherUser.profileImageUrl} />
                        <AvatarFallback className="bg-green-500/20 text-green-500 text-xs">
                          {getInitials(conversation.otherUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-400 truncate">
                            {getUserDisplayName(conversation.otherUser)}
                          </span>
                          {conversation.lastMessage && (
                            <span className="text-xs text-gray-500">
                              {format(new Date(conversation.lastMessage.sentAt), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-xs text-gray-400 truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {conversations.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-8">
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
                <div className="p-4 border-b border-green-500/30 flex items-center space-x-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedChat.otherUser.profileImageUrl} />
                    <AvatarFallback className="bg-green-500/20 text-green-500">
                      {getInitials(selectedChat.otherUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-sm font-medium text-green-500">
                      {getUserDisplayName(selectedChat.otherUser)}
                    </h3>
                    {typingUsers[selectedChat.otherUser.id] && (
                      <p className="text-xs text-green-400">typing...</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-green-500">Loading messages...</div>
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
                            className={cn(
                              "max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm",
                              message.fromUserId === user?.id
                                ? "bg-green-600 text-white"
                                : "bg-gray-700 text-green-400"
                            )}
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
                <div className="p-4 border-t border-green-500/30">
                  <div className="flex space-x-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-800 border-green-500/30 text-green-400 placeholder-gray-500"
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
                      className="bg-green-600 hover:bg-green-700 text-white"
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
                  <MessageCircle className="w-12 h-12 text-green-500/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-green-500 mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-sm text-gray-400">
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