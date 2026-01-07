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
  type InsertKnowledgeChunk,
  users,
  userPreferences,
  conversations,
  documents,
  knowledgeChunks,
  wallpapers, // Assuming 'wallpapers' schema is imported or defined elsewhere
  type Wallpaper, // Assuming 'Wallpaper' type is imported or defined elsewhere
  type InsertWallpaper // Assuming 'InsertWallpaper' type is imported or defined elsewhere
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, like, desc, and, sql } from "drizzle-orm";

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
  updateConversationUserId(sessionId: string, userId: string): Promise<void>;

  // Document methods for knowledge base
  createDocument(document: InsertDocument & { isNote?: boolean; isPersonality?: boolean }): Promise<Document>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByFilename(userId: string, filename: string): Promise<Document | undefined>;
  updateDocument(id: string, updates: Partial<InsertDocument> & { isNote?: boolean; isPersonality?: boolean }): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(userId: string, query: string): Promise<Document[]>;
  getPersonalityDocuments(userId: string): Promise<Document[]>;
  updateDocumentPersonality(id: string, isPersonality: boolean): Promise<Document>;

  // Knowledge chunk methods
  createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk>;
  getDocumentChunks(documentId: string): Promise<KnowledgeChunk[]>;
  searchKnowledgeChunks(userId: string, query: string): Promise<KnowledgeChunk[]>;
  deleteDocumentChunks(documentId: string): Promise<void>;

  // Wallpaper management methods
  getUserWallpapers(userId: string): Promise<Wallpaper[]>;
  createWallpaper(data: InsertWallpaper): Promise<Wallpaper>;
  deleteWallpaper(wallpaperId: string, userId: string): Promise<boolean>;
  setSelectedWallpaper(wallpaperId: string, userId: string): Promise<boolean>;
  clearSelectedWallpaper(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userPreferences: Map<string, UserPreferences>;
  private conversations: Map<string, Conversation>;
  private documents: Map<string, Document>;
  private knowledgeChunks: Map<string, KnowledgeChunk>;
  private wallpapers: Map<string, Wallpaper>; // In-memory store for wallpapers

  constructor() {
    this.users = new Map();
    this.userPreferences = new Map();
    this.conversations = new Map();
    this.documents = new Map();
    this.knowledgeChunks = new Map();
    this.wallpapers = new Map(); // Initialize wallpaper map
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = Array.from(this.users.values()).find(
      (user) => user.email === userData.email
    );

    if (existingUser) {
      // Update existing user - preserve createdAt, only update updatedAt
      const { createdAt, ...updateFields } = userData;
      const updatedUser: User = {
        ...existingUser,
        ...updateFields,
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
        terminalTheme: "hacker",
        pythonIdeTheme: "terminal-green"
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
      terminalTheme: preferences.terminalTheme || "hacker",
      pythonIdeTheme: preferences.pythonIdeTheme || "terminal-green",
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

  async updateConversationUserId(sessionId: string, userId: string): Promise<void> {
    const conversation = await this.getConversation(sessionId);
    if (conversation) {
      conversation.userId = userId;
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
  async createDocument(insertDocument: InsertDocument & { isNote?: boolean; isPersonality?: boolean }): Promise<Document> {
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
      objectPath: insertDocument.objectPath || null,
      summary: insertDocument.summary || null,
      keywords: insertDocument.keywords || null,
      uploadedAt: now,
      lastAccessedAt: now,
      isNote: insertDocument.isNote || false,
      isPersonality: insertDocument.isPersonality || false,
    };
    this.documents.set(id, document);
    return document;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    try {
      const documents = Array.from(this.documents.values())
        .filter(doc => doc.userId === userId)
        .sort((a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0));

      console.log(`📚 Retrieved ${documents.length} documents for user ${userId}`);
      return documents;
    } catch (error) {
      console.error('Error retrieving user documents:', error);
      return [];
    }
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (document) {
      document.lastAccessedAt = new Date();
    }
    return document;
  }

  async getDocumentByFilename(userId: string, filename: string): Promise<Document | undefined> {
    const documents = Array.from(this.documents.values());
    for (const doc of documents) {
      if (doc.userId === userId && doc.originalName.toLowerCase() === filename.toLowerCase()) {
        doc.lastAccessedAt = new Date();
        return doc;
      }
    }
    return undefined;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument> & { isNote?: boolean; isPersonality?: boolean }): Promise<Document> {
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

  async getPersonalityDocuments(userId: string): Promise<Document[]> {
    const userDocs = await this.getUserDocuments(userId);
    return userDocs.filter(doc => doc.isPersonality === true);
  }

  async updateDocumentPersonality(id: string, isPersonality: boolean): Promise<Document> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error("Document not found");
    }

    const updated: Document = {
      ...existing,
      isPersonality,
      lastAccessedAt: new Date()
    };
    this.documents.set(id, updated);
    return updated;
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
    const idsToDelete: string[] = [];
    this.knowledgeChunks.forEach((chunk, id) => {
      if (chunk.documentId === documentId) {
        idsToDelete.push(id);
      }
    });
    idsToDelete.forEach(id => this.knowledgeChunks.delete(id));
  }

  // Wallpaper management methods
  async getUserWallpapers(userId: string): Promise<Wallpaper[]> {
    return Array.from(this.wallpapers.values())
      .filter(wallpaper => wallpaper.userId === userId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async createWallpaper(data: InsertWallpaper): Promise<Wallpaper> {
    const id = data.id || randomUUID();
    const now = new Date();
    const wallpaper: Wallpaper = {
      id,
      userId: data.userId,
      name: data.name,
      objectPath: data.objectPath || null,
      dataUrl: data.dataUrl || null,
      timestamp: now,
      isSelected: data.isSelected || false,
    };
    this.wallpapers.set(id, wallpaper);
    return wallpaper;
  }

  async deleteWallpaper(wallpaperId: string, userId: string): Promise<boolean> {
    if (this.wallpapers.has(wallpaperId) && this.wallpapers.get(wallpaperId)?.userId === userId) {
      this.wallpapers.delete(wallpaperId);
      return true;
    }
    return false;
  }

  async setSelectedWallpaper(wallpaperId: string, userId: string): Promise<boolean> {
    let success = false;
    this.wallpapers.forEach((wallpaper, id) => {
      if (wallpaper.userId === userId) {
        const isSelected = id === wallpaperId;
        wallpaper.isSelected = isSelected;
        if (isSelected) {
          success = true;
        }
      }
    });
    return success;
  }

  async clearSelectedWallpaper(userId: string): Promise<void> {
    this.wallpapers.forEach((wallpaper, id) => {
      if (wallpaper.userId === userId) {
        wallpaper.isSelected = false;
      }
    });
  }
}

export class DatabaseStorage implements IStorage {
  // Inject db instance directly
  constructor(private db: any) {}

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user already exists
    const existingUser = await this.getUser(userData.id!);

    if (existingUser) {
      // Update existing user - preserve createdAt, only update updatedAt
      const { createdAt, ...updateFields } = userData;
      const [user] = await this.db
        .update(users)
        .set({
          ...updateFields,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    } else {
      // Create new user
      const [user] = await this.db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Create default preferences for new user
      if (user) {
        await this.createUserPreferences({
          userId: user.id,
          defaultMode: "natural",
          voiceEnabled: false,
          selectedVoice: "default",
          voiceRate: "1",
          terminalTheme: "hacker",
          pythonIdeTheme: "terminal-green"
        });
      }

      return user;
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await this.db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [prefs] = await this.db.insert(userPreferences).values(preferences).returning();
    return prefs;
  }

  async updateUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [prefs] = await this.db
      .update(userPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return prefs;
  }

  async getConversation(sessionId: string): Promise<Conversation | undefined> {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
    return conversation;
  }

  async getUserConversations(userId: string, limit: number = 50): Promise<Conversation[]> {
    return await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [conv] = await this.db.insert(conversations).values(conversation).returning();
    return conv;
  }

  async updateConversation(sessionId: string, messages: Message[]): Promise<void> {
    await this.db
      .update(conversations)
      .set({ messages: JSON.stringify(messages), updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async addMessageToConversation(sessionId: string, message: Message): Promise<void> {
    const conversation = await this.getConversation(sessionId);
    if (conversation) {
      const messages = Array.isArray(conversation.messages) ? conversation.messages as Message[] : [];
      messages.push(message);
      await this.updateConversation(sessionId, messages);
    } else {
      await this.createConversation({
        sessionId,
        title: message.content.substring(0, 100),
        messages: JSON.stringify([message])
      });
    }
  }

  async updateConversationTitle(sessionId: string, title: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async updateConversationUserId(sessionId: string, userId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ userId, updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async createDocument(document: InsertDocument & { isNote?: boolean }): Promise<Document> {
    const [doc] = await this.db.insert(documents).values({ ...document, isNote: document.isNote || false }).returning();
    return doc;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    const docs = await this.db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt));
    // Return all document fields without modification - the database already has the correct values
    return docs;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await this.db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentByFilename(userId: string, filename: string): Promise<Document | undefined> {
    const [doc] = await this.db.select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          sql`LOWER(${documents.originalName}) = LOWER(${filename})`
        )
      )
      .limit(1);

    // Update last accessed time if document found
    if (doc) {
      await this.db.update(documents)
        .set({ lastAccessedAt: new Date() })
        .where(eq(documents.id, doc.id));
      doc.lastAccessedAt = new Date();
    }

    return doc;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument> & { isNote?: boolean; isPersonality?: boolean }): Promise<Document> {
    const [doc] = await this.db.update(documents).set({ ...updates, lastAccessedAt: new Date() }).where(eq(documents.id, id)).returning();
    return doc;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.db.delete(documents)
      .where(eq(documents.id, documentId));

    // Also delete associated chunks
    await this.deleteDocumentChunks(documentId);
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    return await this.db.select().from(documents)
      .where(and(
        eq(documents.userId, userId),
        like(documents.originalName, `%${query}%`)
      ));
  }

  async getPersonalityDocuments(userId: string): Promise<Document[]> {
    return await this.db.select().from(documents)
      .where(and(
        eq(documents.userId, userId),
        eq(documents.isPersonality, true)
      ))
      .orderBy(desc(documents.uploadedAt));
  }

  async updateDocumentPersonality(id: string, isPersonality: boolean): Promise<Document> {
    const [doc] = await this.db.update(documents)
      .set({ isPersonality, lastAccessedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
    const [chunkResult] = await this.db.insert(knowledgeChunks).values(chunk).returning();
    return chunkResult;
  }

  async getDocumentChunks(documentId: string): Promise<KnowledgeChunk[]> {
    return await this.db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  }

  async searchKnowledgeChunks(userId: string, query: string): Promise<KnowledgeChunk[]> {
    // First get user's document IDs
    const userDocs = await this.getUserDocuments(userId);
    const docIds = userDocs.map(doc => doc.id);

    if (docIds.length === 0) return [];

    // Simple text search in chunks
    return await this.db.select().from(knowledgeChunks)
      .where(like(knowledgeChunks.content, `%${query}%`));
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  }

  // Wallpaper management methods
  async getUserWallpapers(userId: string): Promise<Wallpaper[]> {
    return await this.db.select()
      .from(wallpapers)
      .where(eq(wallpapers.userId, userId))
      .orderBy(desc(wallpapers.timestamp));
  }

  async createWallpaper(data: InsertWallpaper): Promise<Wallpaper> {
    const [wallpaper] = await this.db.insert(wallpapers)
      .values(data)
      .returning();
    return wallpaper;
  }

  async deleteWallpaper(wallpaperId: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(wallpapers)
      .where(
        and(
          eq(wallpapers.id, wallpaperId),
          eq(wallpapers.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async setSelectedWallpaper(wallpaperId: string, userId: string): Promise<boolean> {
    // First, unset all wallpapers for this user
    await this.db.update(wallpapers)
      .set({ isSelected: false })
      .where(eq(wallpapers.userId, userId));

    // Then set the selected one
    const result = await this.db.update(wallpapers)
      .set({ isSelected: true })
      .where(
        and(
          eq(wallpapers.id, wallpaperId),
          eq(wallpapers.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async clearSelectedWallpaper(userId: string): Promise<void> {
    await this.db.update(wallpapers)
      .set({ isSelected: false })
      .where(eq(wallpapers.userId, userId));
  }
}

// Use database storage for persistent document storage
export const storage = new DatabaseStorage(db);