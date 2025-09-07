import { 
  type User, 
  type UpsertUser, 
  type UserPreferences,
  type InsertUserPreferences, 
  type Conversation, 
  type InsertConversation, 
  type Message,
  type Document,
  type InsertDocument,
  type KnowledgeChunk,
  type InsertKnowledgeChunk
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

  // Document methods for knowledge base
  createDocument(document: InsertDocument): Promise<Document>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(userId: string, query: string): Promise<Document[]>;

  // Knowledge chunk methods
  createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk>;
  getDocumentChunks(documentId: string): Promise<KnowledgeChunk[]>;
  searchKnowledgeChunks(userId: string, query: string): Promise<KnowledgeChunk[]>;
  deleteDocumentChunks(documentId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userPreferences: Map<string, UserPreferences>;
  private conversations: Map<string, Conversation>;
  private documents: Map<string, Document>;
  private knowledgeChunks: Map<string, KnowledgeChunk>;

  constructor() {
    this.users = new Map();
    this.userPreferences = new Map();
    this.conversations = new Map();
    this.documents = new Map();
    this.knowledgeChunks = new Map();
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
        id,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
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
      id,
      userId: preferences.userId,
      defaultMode: preferences.defaultMode || "natural",
      voiceEnabled: preferences.voiceEnabled || false,
      selectedVoice: preferences.selectedVoice || null,
      voiceRate: preferences.voiceRate || null,
      terminalTheme: preferences.terminalTheme || null,
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
      id,
      userId: insertConversation.userId || null,
      sessionId: insertConversation.sessionId,
      mode: insertConversation.mode || "natural",
      title: insertConversation.title || null,
      messages: insertConversation.messages || [],
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

  // Document methods implementation
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const document: Document = {
      id,
      userId: insertDocument.userId || null,
      fileName: insertDocument.fileName,
      originalName: insertDocument.originalName,
      fileSize: insertDocument.fileSize,
      mimeType: insertDocument.mimeType,
      content: insertDocument.content,
      summary: insertDocument.summary || null,
      keywords: insertDocument.keywords || null,
      uploadedAt: now,
      lastAccessedAt: now,
    };
    this.documents.set(id, document);
    return document;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.userId === userId)
      .sort((a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (document) {
      document.lastAccessedAt = new Date();
    }
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error("Document not found");
    }

    const updated: Document = {
      ...existing,
      ...updates,
      lastAccessedAt: new Date()
    };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
    // Also delete associated chunks
    await this.deleteDocumentChunks(id);
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    const userDocs = await this.getUserDocuments(userId);
    const searchQuery = query.toLowerCase();
    
    return userDocs.filter(doc => 
      doc.originalName.toLowerCase().includes(searchQuery) ||
      doc.content.toLowerCase().includes(searchQuery) ||
      doc.summary?.toLowerCase().includes(searchQuery) ||
      doc.keywords?.some(keyword => keyword.toLowerCase().includes(searchQuery))
    );
  }

  // Knowledge chunk methods implementation  
  async createKnowledgeChunk(insertChunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
    const id = randomUUID();
    const now = new Date();
    const chunk: KnowledgeChunk = {
      id,
      documentId: insertChunk.documentId,
      chunkIndex: insertChunk.chunkIndex,
      content: insertChunk.content,
      wordCount: insertChunk.wordCount,
      createdAt: now,
    };
    this.knowledgeChunks.set(id, chunk);
    return chunk;
  }

  async getDocumentChunks(documentId: string): Promise<KnowledgeChunk[]> {
    return Array.from(this.knowledgeChunks.values())
      .filter(chunk => chunk.documentId === documentId)
      .sort((a, b) => parseInt(a.chunkIndex) - parseInt(b.chunkIndex));
  }

  async searchKnowledgeChunks(userId: string, query: string): Promise<KnowledgeChunk[]> {
    const userDocIds = new Set(
      (await this.getUserDocuments(userId)).map(doc => doc.id)
    );
    
    const searchQuery = query.toLowerCase();
    
    return Array.from(this.knowledgeChunks.values())
      .filter(chunk => 
        userDocIds.has(chunk.documentId) &&
        chunk.content.toLowerCase().includes(searchQuery)
      )
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    for (const [id, chunk] of this.knowledgeChunks.entries()) {
      if (chunk.documentId === documentId) {
        this.knowledgeChunks.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();
