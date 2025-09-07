import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { messageSchema, type Message, insertUserPreferencesSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { weatherService } from "./weather-service";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Setup authentication middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const preferences = await storage.getUserPreferences(userId);
      
      res.json({ 
        user: user || null,
        preferences: preferences || null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // User preferences routes
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist
        const defaultPrefs = await storage.createUserPreferences({
          userId,
          defaultMode: "natural",
          voiceEnabled: false,
          selectedVoice: "default",
          voiceRate: "1",
          terminalTheme: "classic"
        });
        return res.json(defaultPrefs);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = insertUserPreferencesSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid preferences data",
          details: validationResult.error.errors
        });
      }
      
      const updatedPreferences = await storage.updateUserPreferences(userId, validationResult.data);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User conversation history routes
  app.get("/api/user/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get user conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chat endpoint (enhanced with user support)
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
      
      // Check if user is authenticated to link conversation
      let userId = null;
      const user = req.user as any;
      if (req.isAuthenticated?.() && user?.claims?.sub) {
        userId = user.claims.sub;
      }
      
      // Add user message to conversation
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, userMessage);
      
      // Link conversation to user if authenticated
      if (userId) {
        const conversation = await storage.getConversation(currentSessionId);
        if (conversation && !conversation.userId) {
          // Update the conversation to link it to the user
          conversation.userId = userId;
        }
      }
      
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

  // Weather API endpoints
  app.get("/api/weather/current/:location", async (req, res) => {
    try {
      const { location } = req.params;
      const weather = await weatherService.getCurrentWeather(location);
      const formattedWeather = weatherService.formatCurrentWeather(weather);
      
      res.json({
        weather,
        formatted: formattedWeather
      });
    } catch (error) {
      console.error("Weather error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch weather data";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/weather/forecast/:location", async (req, res) => {
    try {
      const { location } = req.params;
      const days = parseInt(req.query.days as string) || 5;
      const forecast = await weatherService.getForecast(location, days);
      const formattedForecast = weatherService.formatForecast(forecast, location);
      
      res.json({
        forecast,
        formatted: formattedForecast
      });
    } catch (error) {
      console.error("Forecast error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch forecast data";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/weather/coordinates", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }
      
      const weather = await weatherService.getWeatherByCoordinates(lat, lon);
      const formattedWeather = weatherService.formatCurrentWeather(weather);
      
      res.json({
        weather,
        formatted: formattedWeather
      });
    } catch (error) {
      console.error("Weather by coordinates error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch weather data";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/weather/forecast/coordinates", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const days = parseInt(req.query.days as string) || 5;
      
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }
      
      // Get location name first
      const currentWeather = await weatherService.getWeatherByCoordinates(lat, lon);
      const forecast = await weatherService.getForecast(currentWeather.location, days);
      const formattedForecast = weatherService.formatForecast(forecast, currentWeather.location);
      
      res.json({
        forecast,
        formatted: formattedForecast
      });
    } catch (error) {
      console.error("Forecast by coordinates error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch forecast data";
      res.status(500).json({ error: message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

