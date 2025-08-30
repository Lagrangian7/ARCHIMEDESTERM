import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { messageSchema, type Message } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";

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
      
      // Get conversation history for context
      const conversation = await storage.getConversation(currentSessionId);
      const conversationHistory = Array.isArray(conversation?.messages) ? conversation.messages as Message[] : [];
      
      // Generate AI response using LLM
      const responseContent = await llmService.generateResponse(message, mode as "natural" | "technical", conversationHistory);
      
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

