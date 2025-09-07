import { 
  type User, 
  type UpsertUser, 
  type UserPreferences,
  type InsertUserPreferences, 
  type Conversation, 
  type InsertConversation, 
  type Message 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  
  // Conversation methods
  getConversation(sessionId: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(sessionId: string, messages: Message[]): Promise<void>;
  addMessageToConversation(sessionId: string, message: Message): Promise<void>;
  updateConversationTitle(sessionId: string, title: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userPreferences: Map<string, UserPreferences>;
  private conversations: Map<string, Conversation>;

  constructor() {
    this.users = new Map();
    this.userPreferences = new Map();
    this.conversations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = Array.from(this.users.values()).find(
      (user) => user.email === userData.email
    );

    if (existingUser) {
      // Update existing user
      const updatedUser: User = { 
        ...existingUser, 
        ...userData, 
        updatedAt: new Date() 
      };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const id = randomUUID();
      const now = new Date();
      const user: User = { 
        ...userData, 
        id, 
        createdAt: now,
        updatedAt: now 
      };
      this.users.set(id, user);
      
      // Create default preferences
      await this.createUserPreferences({
        userId: id,
        defaultMode: "natural",
        voiceEnabled: false,
        selectedVoice: "default",
        voiceRate: "1",
        terminalTheme: "classic"
      });
      
      return user;
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return Array.from(this.userPreferences.values()).find(
      (prefs) => prefs.userId === userId
    );
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const id = randomUUID();
    const now = new Date();
    const userPrefs: UserPreferences = { 
      ...preferences, 
      id, 
      createdAt: now,
      updatedAt: now 
    };
    this.userPreferences.set(id, userPrefs);
    return userPrefs;
  }

  async updateUserPreferences(userId: string, updates: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    if (!existing) {
      throw new Error("User preferences not found");
    }

    const updated: UserPreferences = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.userPreferences.set(existing.id, updated);
    return updated;
  }

  async getConversation(sessionId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.sessionId === sessionId
    );
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter((conv) => conv.userId === userId)
      .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const now = new Date();
    const conversation: Conversation = { 
      ...insertConversation,
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(sessionId: string, messages: Message[]): Promise<void> {
    const conversation = await this.getConversation(sessionId);
    if (conversation) {
      conversation.messages = messages as any;
      conversation.updatedAt = new Date();
    }
  }

  async updateConversationTitle(sessionId: string, title: string): Promise<void> {
    const conversation = await this.getConversation(sessionId);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date();
    }
  }

  async addMessageToConversation(sessionId: string, message: Message): Promise<void> {
    let conversation = await this.getConversation(sessionId);
    
    if (!conversation) {
      // Generate a conversation title based on the first user message
      const title = message.role === 'user' 
        ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
        : 'New Conversation';

      conversation = await this.createConversation({
        sessionId,
        userId: null, // Will be set by the API if user is authenticated
        mode: message.mode,
        title,
        messages: [],
      });
    }
    
    const messages = Array.isArray(conversation.messages) ? conversation.messages as Message[] : [];
    messages.push(message);
    await this.updateConversation(sessionId, messages);
  }
}

export const storage = new MemStorage();
