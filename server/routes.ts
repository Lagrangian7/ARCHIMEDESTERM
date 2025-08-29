import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { messageSchema } from "@shared/schema";
import { randomUUID } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, mode = "natural", sessionId } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validModes = ["natural", "technical"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }

      const currentSessionId = sessionId || randomUUID();
      
      // Add user message to conversation
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, userMessage);
      
      // Generate AI response based on mode
      let responseContent: string;
      
      if (mode === "natural") {
        responseContent = generateNaturalResponse(message);
      } else {
        responseContent = generateTechnicalResponse(message);
      }
      
      const assistantMessage = {
        role: "assistant" as const,
        content: responseContent,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, assistantMessage);
      
      res.json({
        response: responseContent,
        sessionId: currentSessionId,
        mode,
      });
      
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get conversation history
  app.get("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const conversation = await storage.getConversation(sessionId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateNaturalResponse(input: string): string {
  // Natural chat responses - conversational and friendly
  const responses = {
    greetings: [
      "Hey there! I'm Archimedes v7, your AI assistant. How can I help you today?",
      "Hello! Great to meet you. What's on your mind?",
      "Hi! I'm here to help with whatever you need. What would you like to explore?",
    ],
    help: [
      "I'm here to assist you! I can switch between natural conversation and technical mode. Just ask me anything or type 'mode technical' to switch to my detailed technical protocol.",
      "Sure thing! I can chat naturally like this, or switch to technical mode for detailed, step-by-step responses. What would you like help with?",
    ],
    default: [
      "That's an interesting question! I'd love to help you explore that topic further.",
      "I hear you! Let me think about that for a moment...",
      "Great question! I can definitely help you with that.",
    ],
  };

  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes("hello") || lowerInput.includes("hi") || lowerInput.includes("hey")) {
    return responses.greetings[Math.floor(Math.random() * responses.greetings.length)];
  }
  
  if (lowerInput.includes("help")) {
    return responses.help[Math.floor(Math.random() * responses.help.length)];
  }
  
  return `I understand you're asking about: "${input}". In natural chat mode, I provide conversational and approachable responses. How can I help you explore this topic further?`;
}

function generateTechnicalResponse(input: string): string {
  // Technical ARCHIMEDES protocol responses
  return `ARCHIMEDES v7 active. Concise Technical Chronicle Mode.
Topic: ${input}
Simulation Chronicle follows.

Analysis Parameters:
- Query complexity: ${input.split(' ').length} token analysis
- Response protocol: Direct, stepwise, explicit
- Technical framework: Active

Technical Chronicle:
1. Input processing complete
   Rationale: Query parsed using natural language processing protocols
2. Knowledge synthesis initiated  
   Rationale: Cross-referencing technical databases and simulation archives
3. Response formatting per ARCHIMEDES v7 standards
   Rationale: Ensures maximum clarity and actionable technical detail

Note: This is a demonstration interface. Full implementation would provide detailed technical procedures, material lists, and step-by-step protocols for the queried topic.`;
}
