import { useState } from "react";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, MessageSquare, Brain, Wrench } from "lucide-react";
import type { Conversation, Message } from "@shared/schema";

interface ConversationHistoryProps {
  onClose: () => void;
  onLoadConversation?: (sessionId: string) => void;
}

export function ConversationHistory({ onClose, onLoadConversation }: ConversationHistoryProps) {
  const { isAuthenticated } = useAuth();
  const { conversations, isLoading } = useConversationHistory();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  if (!isAuthenticated) {
    return (
      <Card className="bg-black/90 border-green-400/30 text-green-400">
        <CardHeader>
          <CardTitle className="text-green-400">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Please log in to view your conversation history.</p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-green-500 text-black hover:bg-green-400"
          >
            Log In
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            className="border-green-400/30 text-green-400 hover:bg-green-400/10"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getConversationPreview = (messages: unknown): string => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return "No messages";
    }
    
    const firstUserMessage = messages.find((msg: any) => msg.role === "user");
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? "..." : "");
    }
    
    return "New conversation";
  };

  const loadConversation = (conversation: Conversation) => {
    if (onLoadConversation) {
      onLoadConversation(conversation.sessionId);
      onClose();
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-black/90 border-green-400/30 text-green-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={20} />
            Loading Conversation History...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-green-400/10 rounded border"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/95 border-green-400/50 text-green-400 max-w-4xl w-full max-h-[80vh]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History size={20} />
            Conversation History ({conversations.length})
          </CardTitle>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-green-400 hover:text-green-300"
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-green-300">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>No conversation history yet.</p>
            <p className="text-sm">Start chatting to build your history!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[60vh]">
            <ScrollArea className="border-r border-green-400/20">
              <div className="p-4 space-y-3">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`cursor-pointer p-4 rounded-lg border transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? "border-green-400 bg-green-400/10"
                        : "border-green-400/20 hover:border-green-400/40 hover:bg-green-400/5"
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {conversation.mode === "technical" ? (
                            <Wrench size={14} className="text-orange-400" />
                          ) : (
                            <Brain size={14} className="text-blue-400" />
                          )}
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              conversation.mode === "technical" 
                                ? "border-orange-400/50 text-orange-400" 
                                : "border-blue-400/50 text-blue-400"
                            }`}
                          >
                            {conversation.mode}
                          </Badge>
                        </div>
                        <h4 className="font-mono text-sm font-semibold truncate">
                          {conversation.title || "Untitled Conversation"}
                        </h4>
                        <p className="text-xs text-green-300 truncate mt-1">
                          {getConversationPreview(conversation.messages)}
                        </p>
                        <p className="text-xs text-green-400/60 mt-2">
                          {formatDate(conversation.updatedAt!)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadConversation(conversation);
                        }}
                        size="sm"
                        className="bg-green-500 text-black hover:bg-green-400 text-xs"
                      >
                        Load
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-4">
              {selectedConversation ? (
                <div className="space-y-4">
                  <div className="border-b border-green-400/20 pb-4">
                    <h3 className="font-mono font-semibold">
                      {selectedConversation.title || "Untitled Conversation"}
                    </h3>
                    <p className="text-sm text-green-300">
                      {formatDate(selectedConversation.createdAt!)} - {formatDate(selectedConversation.updatedAt!)}
                    </p>
                    <Badge 
                      variant="outline"
                      className={`mt-2 ${
                        selectedConversation.mode === "technical" 
                          ? "border-orange-400/50 text-orange-400" 
                          : "border-blue-400/50 text-blue-400"
                      }`}
                    >
                      {selectedConversation.mode} mode
                    </Badge>
                  </div>
                  
                  <ScrollArea className="h-[40vh]">
                    <div className="space-y-3">
                      {Array.isArray(selectedConversation.messages) && 
                        (selectedConversation.messages as Message[]).map((message, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded border ${
                              message.role === "user"
                                ? "border-green-400/30 bg-green-400/5"
                                : "border-blue-400/30 bg-blue-400/5"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge 
                                variant="outline"
                                className={`text-xs ${
                                  message.role === "user"
                                    ? "border-green-400/50 text-green-400"
                                    : "border-blue-400/50 text-blue-400"
                                }`}
                              >
                                {message.role === "user" ? "USER" : "ARCHIMEDES"}
                              </Badge>
                              <span className="text-xs text-green-400/60">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-mono whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-green-300">
                  <div className="text-center">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}