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
  knowledgeChunks
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
  createDocument(document: InsertDocument): Promise<Document>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByFilename(userId: string, filename: string): Promise<Document | undefined>;
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
      objectPath: insertDocument.objectPath || null,
      summary: insertDocument.summary || null,
      keywords: insertDocument.keywords || null,
      uploadedAt: now,
      lastAccessedAt: now,
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
    const idsToDelete: string[] = [];
    this.knowledgeChunks.forEach((chunk, id) => {
      if (chunk.documentId === documentId) {
        idsToDelete.push(id);
      }
    });
    idsToDelete.forEach(id => this.knowledgeChunks.delete(id));
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    let presence = Array.from(this.userPresences.values()).find(p => p.userId === userId);

    if (presence) {
      presence.isOnline = isOnline;
      presence.lastSeen = new Date();
      presence.socketId = socketId || null;
      presence.updatedAt = new Date();
    } else {
      const id = randomUUID();
      const now = new Date();
      presence = {
        id,
        userId,
        isOnline,
        lastSeen: now,
        socketId: socketId || null,
        status: "online",
        createdAt: now,
        updatedAt: now,
      };
      this.userPresences.set(id, presence);
    }

    return presence;
  }

  async getUserPresence(userId: string): Promise<UserPresence | undefined> {
    return Array.from(this.userPresences.values()).find(p => p.userId === userId);
  }

  async getOnlineUsers(): Promise<(User & { presence: UserPresence })[]> {
    const onlinePresences = Array.from(this.userPresences.values()).filter(p => p.isOnline);
    const result: (User & { presence: UserPresence })[] = [];

    for (const presence of onlinePresences) {
      const user = this.users.get(presence.userId);
      if (user) {
        result.push({ ...user, presence });
      }
    }

    return result;
  }

  async setUserOffline(socketId: string): Promise<void> {
    const presence = Array.from(this.userPresences.values()).find(p => p.socketId === socketId);
    if (presence) {
      presence.isOnline = false;
      presence.lastSeen = new Date();
      presence.socketId = null;
      presence.updatedAt = new Date();
    }
  }

  // Direct chat methods implementation
  async getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<DirectChat> {
    // Look for existing chat between these users
    const existingChat = Array.from(this.directChats.values()).find(chat =>
      (chat.user1Id === user1Id && chat.user2Id === user2Id) ||
      (chat.user1Id === user2Id && chat.user2Id === user1Id)
    );

    if (existingChat) {
      return existingChat;
    }

    // Create new chat
    const id = randomUUID();
    const now = new Date();
    const chat: DirectChat = {
      id,
      user1Id,
      user2Id,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.directChats.set(id, chat);
    return chat;
  }

  async getUserDirectChats(userId: string): Promise<(DirectChat & { otherUser: User; lastMessage?: UserMessage })[]> {
    const userChats = Array.from(this.directChats.values()).filter(chat =>
      chat.user1Id === userId || chat.user2Id === userId
    );

    const result: (DirectChat & { otherUser: User; lastMessage?: UserMessage })[] = [];

    for (const chat of userChats) {
      const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const otherUser = this.users.get(otherUserId);

      if (otherUser) {
        // Get last message for this chat
        const chatMessages = Array.from(this.userMessages.values())
          .filter(msg => msg.chatId === chat.id)
          .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

        const lastMessage = chatMessages[0];

        result.push({
          ...chat,
          otherUser,
          lastMessage
        });
      }
    }

    return result.sort((a, b) => {
      const aTime = a.lastMessage?.sentAt.getTime() || a.createdAt?.getTime() || 0;
      const bTime = b.lastMessage?.sentAt.getTime() || b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  // Message methods implementation
  async sendMessage(message: InsertUserMessage): Promise<UserMessage> {
    const id = randomUUID();
    const now = new Date();
    const userMessage: UserMessage = {
      id,
      chatId: message.chatId,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId,
      content: message.content,
      messageType: message.messageType || "text",
      isRead: message.isRead || false,
      isDelivered: message.isDelivered || false,
      sentAt: now,
      readAt: message.readAt || null,
    };

    this.userMessages.set(id, userMessage);

    // Update chat's lastMessageAt
    const chat = this.directChats.get(message.chatId);
    if (chat) {
      chat.lastMessageAt = now;
      chat.updatedAt = now;
    }

    return userMessage;
  }

  async getChatMessages(chatId: string, limit: number = 50): Promise<UserMessage[]> {
    return Array.from(this.userMessages.values())
      .filter(msg => msg.chatId === chatId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .slice(-limit);
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const message = this.userMessages.get(messageId);
    if (message) {
      message.isRead = true;
      message.readAt = new Date();
    }
  }

  async markMessagesAsDelivered(userId: string): Promise<void> {
    this.userMessages.forEach(message => {
      if (message.toUserId === userId && !message.isDelivered) {
        message.isDelivered = true;
      }
    });
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    return Array.from(this.userMessages.values())
      .filter(msg => msg.toUserId === userId && !msg.isRead)
      .length;
  }

  // MUD profile methods implementation (memory storage)
  async createMudProfile(profile: InsertMudProfile): Promise<MudProfile> {
    if (!profile.userId) {
      throw new Error('User ID is required for MUD profile');
    }
    const id = randomUUID();
    const now = new Date();
    const mudProfile: MudProfile = {
      id,
      userId: profile.userId,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      description: profile.description || null,
      aliases: profile.aliases || {},
      triggers: profile.triggers || [],
      macros: profile.macros || {},
      autoConnect: profile.autoConnect ?? false,
      theme: profile.theme || "classic",
      fontSize: profile.fontSize || "14",
      scrollbackLines: profile.scrollbackLines || "1000",
      enableAnsi: profile.enableAnsi ?? true,
      enableTriggers: profile.enableTriggers ?? true,
      enableAliases: profile.enableAliases ?? true,
      enableLog: profile.enableLog ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.mudProfiles.set(id, mudProfile);
    return mudProfile;
  }

  async getUserMudProfiles(userId: string): Promise<MudProfile[]> {
    return Array.from(this.mudProfiles.values())
      .filter(profile => profile.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getMudProfile(id: string): Promise<MudProfile | undefined> {
    return this.mudProfiles.get(id);
  }

  async updateMudProfile(id: string, updates: Partial<InsertMudProfile>): Promise<MudProfile> {
    const existing = this.mudProfiles.get(id);
    if (!existing) {
      throw new Error(`MUD profile with id ${id} not found`);
    }
    const updated: MudProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.mudProfiles.set(id, updated);
    return updated;
  }

  async deleteMudProfile(id: string): Promise<void> {
    this.mudProfiles.delete(id);
  }

  // MUD session methods implementation (memory storage)
  async createMudSession(session: InsertMudSession): Promise<MudSession> {
    if (!session.userId) {
      throw new Error('User ID is required for MUD session');
    }
    const id = randomUUID();
    const now = new Date();
    const mudSession: MudSession = {
      id,
      userId: session.userId,
      profileId: session.profileId || null,
      sessionId: session.sessionId,
      status: session.status || "disconnected",
      connectTime: session.connectTime || null,
      disconnectTime: session.disconnectTime || null,
      lastActivity: session.lastActivity || now,
      bytesReceived: session.bytesReceived || "0",
      bytesSent: session.bytesSent || "0",
      commandCount: session.commandCount || "0",
      errorMessage: session.errorMessage || null,
      createdAt: now,
    };
    this.mudSessions.set(id, mudSession);
    return mudSession;
  }

  async getMudSession(sessionId: string): Promise<MudSession | undefined> {
    return Array.from(this.mudSessions.values())
      .find(session => session.sessionId === sessionId);
  }

  async getUserMudSessions(userId: string): Promise<MudSession[]> {
    return Array.from(this.mudSessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async updateMudSession(id: string, updates: Partial<InsertMudSession>): Promise<MudSession> {
    const existing = this.mudSessions.get(id);
    if (!existing) {
      throw new Error(`MUD session with id ${id} not found`);
    }
    const updated: MudSession = {
      ...existing,
      ...updates,
    };
    this.mudSessions.set(id, updated);
    return updated;
  }

  async closeMudSession(sessionId: string): Promise<void> {
    const session = Array.from(this.mudSessions.values())
      .find(s => s.sessionId === sessionId);
    if (session) {
      session.status = "disconnected";
      session.disconnectTime = new Date();
    }
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user already exists
    const existingUser = await this.getUser(userData.id!);

    if (existingUser) {
      // Update existing user - preserve createdAt, only update updatedAt
      const { createdAt, ...updateFields } = userData;
      const [user] = await db
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
      const [user] = await db
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
          terminalTheme: "classic"
        });
      }

      return user;
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return prefs;
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [prefs] = await db.insert(userPreferences).values(preferences).returning();
    return prefs;
  }

  async updateUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [prefs] = await db
      .update(userPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return prefs;
  }

  async getConversation(sessionId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
    return conversation;
  }

  async getUserConversations(userId: string, limit: number = 50): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values(conversation).returning();
    return conv;
  }

  async updateConversation(sessionId: string, messages: Message[]): Promise<void> {
    await db
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
    await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async updateConversationUserId(sessionId: string, userId: string): Promise<void> {
    await db
      .update(conversations)
      .set({ userId, updatedAt: new Date() })
      .where(eq(conversations.sessionId, sessionId));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(document).returning();
    return doc;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    const docs = await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt));
    // Return all document fields without modification - the database already has the correct values
    return docs;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentByFilename(userId: string, filename: string): Promise<Document | undefined> {
    const [doc] = await db.select()
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
      await db.update(documents)
        .set({ lastAccessedAt: new Date() })
        .where(eq(documents.id, doc.id));
      doc.lastAccessedAt = new Date();
    }

    return doc;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [doc] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    return await db.select().from(documents)
      .where(and(
        eq(documents.userId, userId),
        like(documents.originalName, `%${query}%`)
      ));
  }

  async createKnowledgeChunk(chunk: InsertKnowledgeChunk): Promise<KnowledgeChunk> {
    const [chunkResult] = await db.insert(knowledgeChunks).values(chunk).returning();
    return chunkResult;
  }

  async getDocumentChunks(documentId: string): Promise<KnowledgeChunk[]> {
    return await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  }

  async searchKnowledgeChunks(userId: string, query: string): Promise<KnowledgeChunk[]> {
    // First get user's document IDs
    const userDocs = await this.getUserDocuments(userId);
    const docIds = userDocs.map(doc => doc.id);

    if (docIds.length === 0) return [];

    // Simple text search in chunks
    return await db.select().from(knowledgeChunks)
      .where(like(knowledgeChunks.content, `%${query}%`));
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  }
}

// Use database storage for persistent document storage
export const storage = new DatabaseStorage();
