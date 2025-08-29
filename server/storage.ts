import { type User, type InsertUser, type Conversation, type InsertConversation, type Message } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversation methods
  getConversation(sessionId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(sessionId: string, messages: Message[]): Promise<void>;
  addMessageToConversation(sessionId: string, message: Message): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConversation(sessionId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.sessionId === sessionId
    );
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

  async addMessageToConversation(sessionId: string, message: Message): Promise<void> {
    let conversation = await this.getConversation(sessionId);
    
    if (!conversation) {
      conversation = await this.createConversation({
        sessionId,
        mode: message.mode,
        messages: [],
      });
    }
    
    const messages = Array.isArray(conversation.messages) ? conversation.messages as Message[] : [];
    messages.push(message);
    await this.updateConversation(sessionId, messages);
  }
}

export const storage = new MemStorage();
