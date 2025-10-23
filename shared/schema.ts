import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User preferences table
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  defaultMode: text("default_mode").notNull().default("natural"), // "natural" | "technical"
  voiceEnabled: boolean("voice_enabled").notNull().default(false),
  selectedVoice: text("selected_voice").default("default"),
  voiceRate: text("voice_rate").default("1"),
  terminalTheme: text("terminal_theme").default("classic"), // "classic" | "neon" | "minimal"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversations now linked to users
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Optional for anonymous sessions
  sessionId: text("session_id").notNull(),
  mode: text("mode").notNull().default("natural"), // "natural" | "technical"
  title: text("title"), // Auto-generated conversation title
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  conversations: many(conversations),
  documents: many(documents),
  presence: one(userPresence, {
    fields: [users.id],
    references: [userPresence.userId],
  }),
  directChatsAsUser1: many(directChats, { relationName: "user1" }),
  directChatsAsUser2: many(directChats, { relationName: "user2" }),
  sentMessages: many(userMessages, { relationName: "fromUser" }),
  receivedMessages: many(userMessages, { relationName: "toUser" }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));

// Schema definitions for form validation and API
export const upsertUserSchema = createInsertSchema(users);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
  mode: z.enum(["natural", "technical"]),
});

// Type exports
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = z.infer<typeof messageSchema>;

// Document storage tables for knowledge base
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  fileSize: varchar("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  content: text("content").notNull(),
  objectPath: varchar("object_path"), // Object storage path for uploaded files
  summary: text("summary"),
  keywords: text("keywords").array(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: varchar("chunk_index").notNull(),
  content: text("content").notNull(),
  wordCount: varchar("word_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document relations
export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  document: one(documents, {
    fields: [knowledgeChunks.documentId],
    references: [documents.id],
  }),
}));

// Document schema definitions
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
  lastAccessedAt: true,
});

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).omit({
  id: true,
  createdAt: true,
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;

// BBS Directory tables for retro computing portal
export const bbsSystems = pgTable("bbs_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  host: varchar("host").notNull(),
  port: varchar("port").notNull(),
  phoneNumber: varchar("phone_number"), // Historical phone numbers
  location: varchar("location"),
  sysopName: varchar("sysop_name"),
  sysopEmail: varchar("sysop_email"),
  software: varchar("software"), // BBS software type
  nodes: varchar("nodes").default("1"), // Number of lines
  isActive: boolean("is_active").notNull().default(true),
  lastChecked: timestamp("last_checked"),
  lastOnline: timestamp("last_online"),
  connectionsToday: varchar("connections_today").default("0"),
  totalConnections: varchar("total_connections").default("0"),
  features: text("features").array(), // telnet, SSH, web, etc.
  categories: text("categories").array(), // General, Games, Programming, etc.
  establishedYear: varchar("established_year"),
  rating: varchar("rating").default("0"), // User rating 0-5
  ratingCount: varchar("rating_count").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbsConnections = pgTable("bbs_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  bbsId: varchar("bbs_id").references(() => bbsSystems.id).notNull(),
  sessionId: varchar("session_id").notNull(),
  connectionType: varchar("connection_type").notNull().default("telnet"), // telnet, ssh, web
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  duration: varchar("duration"), // in seconds
  bytesTransmitted: varchar("bytes_transmitted").default("0"),
  isActive: boolean("is_active").notNull().default(true),
});

export const bbsFavorites = pgTable("bbs_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bbsId: varchar("bbs_id").references(() => bbsSystems.id).notNull(),
  nickname: varchar("nickname"), // User's custom name for this BBS
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
});

export const bbsRatings = pgTable("bbs_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bbsId: varchar("bbs_id").references(() => bbsSystems.id).notNull(),
  rating: varchar("rating").notNull(), // 1-5 stars
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Virtual network systems for simulation
export const virtualSystems = pgTable("virtual_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  hostname: varchar("hostname").notNull().unique(),
  systemType: varchar("system_type").notNull(), // unix, vms, dos, bbs, etc.
  description: text("description"),
  welcomeMessage: text("welcome_message"),
  motd: text("motd"), // Message of the day
  fileSystem: jsonb("file_system").notNull().default('{}'), // Virtual file structure
  commands: jsonb("commands").notNull().default('[]'), // Available commands
  programs: jsonb("programs").notNull().default('[]'), // Runnable programs
  networks: text("networks").array().default([]), // Connected networks
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Network topology for simulated vintage networks
export const networkConnections = pgTable("network_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromSystemId: varchar("from_system_id").references(() => virtualSystems.id).notNull(),
  toSystemId: varchar("to_system_id").references(() => virtualSystems.id).notNull(),
  connectionType: varchar("connection_type").notNull(), // direct, dialup, packet, internet
  latency: varchar("latency").default("0"), // Simulated network delay
  reliability: varchar("reliability").default("100"), // Connection reliability %
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// BBS relations
export const bbsSystemsRelations = relations(bbsSystems, ({ many }) => ({
  connections: many(bbsConnections),
  favorites: many(bbsFavorites),
  ratings: many(bbsRatings),
}));

export const bbsConnectionsRelations = relations(bbsConnections, ({ one }) => ({
  user: one(users, {
    fields: [bbsConnections.userId],
    references: [users.id],
  }),
  bbs: one(bbsSystems, {
    fields: [bbsConnections.bbsId],
    references: [bbsSystems.id],
  }),
}));

export const bbsFavoritesRelations = relations(bbsFavorites, ({ one }) => ({
  user: one(users, {
    fields: [bbsFavorites.userId],
    references: [users.id],
  }),
  bbs: one(bbsSystems, {
    fields: [bbsFavorites.bbsId],
    references: [bbsSystems.id],
  }),
}));

export const bbsRatingsRelations = relations(bbsRatings, ({ one }) => ({
  user: one(users, {
    fields: [bbsRatings.userId],
    references: [users.id],
  }),
  bbs: one(bbsSystems, {
    fields: [bbsRatings.bbsId],
    references: [bbsSystems.id],
  }),
}));

// Virtual systems relations
export const virtualSystemsRelations = relations(virtualSystems, ({ many }) => ({
  outboundConnections: many(networkConnections, { relationName: "fromSystem" }),
  inboundConnections: many(networkConnections, { relationName: "toSystem" }),
}));

export const networkConnectionsRelations = relations(networkConnections, ({ one }) => ({
  fromSystem: one(virtualSystems, {
    fields: [networkConnections.fromSystemId],
    references: [virtualSystems.id],
    relationName: "fromSystem",
  }),
  toSystem: one(virtualSystems, {
    fields: [networkConnections.toSystemId],
    references: [virtualSystems.id],
    relationName: "toSystem",
  }),
}));

// BBS schema definitions
export const insertBbsSystemSchema = createInsertSchema(bbsSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastChecked: true,
  lastOnline: true,
});

export const insertBbsConnectionSchema = createInsertSchema(bbsConnections).omit({
  id: true,
  startTime: true,
});

export const insertBbsFavoriteSchema = createInsertSchema(bbsFavorites).omit({
  id: true,
  addedAt: true,
});

export const insertVirtualSystemSchema = createInsertSchema(virtualSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User-to-User Chat System Tables
export const userPresence = pgTable("user_presence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  socketId: varchar("socket_id"), // WebSocket connection ID
  status: varchar("status").default("online"), // online, away, busy, offline
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const directChats = pgTable("direct_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").references(() => users.id).notNull(),
  user2Id: varchar("user2_id").references(() => users.id).notNull(),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userMessages = pgTable("user_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").references(() => directChats.id).notNull(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").notNull().default("text"), // text, image, file, system
  isRead: boolean("is_read").notNull().default(false),
  isDelivered: boolean("is_delivered").notNull().default(false),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

// Chat system relations
export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
}));

export const directChatsRelations = relations(directChats, ({ one, many }) => ({
  user1: one(users, {
    fields: [directChats.user1Id],
    references: [users.id],
    relationName: "user1",
  }),
  user2: one(users, {
    fields: [directChats.user2Id],
    references: [users.id],
    relationName: "user2",
  }),
  messages: many(userMessages),
}));

export const userMessagesRelations = relations(userMessages, ({ one }) => ({
  chat: one(directChats, {
    fields: [userMessages.chatId],
    references: [directChats.id],
  }),
  fromUser: one(users, {
    fields: [userMessages.fromUserId],
    references: [users.id],
    relationName: "fromUser",
  }),
  toUser: one(users, {
    fields: [userMessages.toUserId],
    references: [users.id],
    relationName: "toUser",
  }),
}));

// Chat schema definitions
export const insertUserPresenceSchema = createInsertSchema(userPresence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDirectChatSchema = createInsertSchema(directChats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserMessageSchema = createInsertSchema(userMessages).omit({
  id: true,
  sentAt: true,
});

// User message schema for validation
export const userMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  messageType: z.enum(["text", "image", "file", "system"]).default("text"),
});

// Type exports
export type BbsSystem = typeof bbsSystems.$inferSelect;
export type InsertBbsSystem = z.infer<typeof insertBbsSystemSchema>;
export type BbsConnection = typeof bbsConnections.$inferSelect;
export type InsertBbsConnection = z.infer<typeof insertBbsConnectionSchema>;
export type BbsFavorite = typeof bbsFavorites.$inferSelect;
export type InsertBbsFavorite = z.infer<typeof insertBbsFavoriteSchema>;
export type BbsRating = typeof bbsRatings.$inferSelect;
export type VirtualSystem = typeof virtualSystems.$inferSelect;
export type InsertVirtualSystem = z.infer<typeof insertVirtualSystemSchema>;
export type NetworkConnection = typeof networkConnections.$inferSelect;

// Chat system types
export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = z.infer<typeof insertUserPresenceSchema>;
export type DirectChat = typeof directChats.$inferSelect;
export type InsertDirectChat = z.infer<typeof insertDirectChatSchema>;
export type UserMessage = typeof userMessages.$inferSelect;
export type InsertUserMessage = z.infer<typeof insertUserMessageSchema>;

// MUD Client tables for persistent MUD connectivity
export const mudProfiles = pgTable("mud_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  host: varchar("host").notNull(),
  port: varchar("port").notNull(),
  description: text("description"),
  aliases: jsonb("aliases").notNull().default('{}'), // { "alias": "expansion" }
  triggers: jsonb("triggers").notNull().default('[]'), // [ { pattern, response, enabled } ]
  macros: jsonb("macros").notNull().default('{}'), // { "key": "command" }
  autoConnect: boolean("auto_connect").notNull().default(false),
  theme: varchar("theme").default("classic"), // classic, green, amber, etc
  fontSize: varchar("font_size").default("14"),
  scrollbackLines: varchar("scrollback_lines").default("1000"),
  enableAnsi: boolean("enable_ansi").notNull().default(true),
  enableTriggers: boolean("enable_triggers").notNull().default(true),
  enableAliases: boolean("enable_aliases").notNull().default(true),
  enableLog: boolean("enable_log").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mudSessions = pgTable("mud_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  profileId: varchar("profile_id").references(() => mudProfiles.id),
  sessionId: varchar("session_id").notNull(), // WebSocket session identifier
  status: varchar("status").notNull().default("disconnected"), // connected, disconnected, connecting, error
  connectTime: timestamp("connect_time"),
  disconnectTime: timestamp("disconnect_time"),
  lastActivity: timestamp("last_activity").defaultNow(),
  bytesReceived: varchar("bytes_received").default("0"),
  bytesSent: varchar("bytes_sent").default("0"),
  commandCount: varchar("command_count").default("0"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// MUD client relations
export const mudProfilesRelations = relations(mudProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [mudProfiles.userId],
    references: [users.id],
  }),
  sessions: many(mudSessions),
}));

export const mudSessionsRelations = relations(mudSessions, ({ one }) => ({
  user: one(users, {
    fields: [mudSessions.userId],
    references: [users.id],
  }),
  profile: one(mudProfiles, {
    fields: [mudSessions.profileId],
    references: [mudProfiles.id],
  }),
}));

// MUD schema definitions
export const insertMudProfileSchema = createInsertSchema(mudProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMudSessionSchema = createInsertSchema(mudSessions).omit({
  id: true,
  createdAt: true,
});

// MUD alias and trigger schemas for validation
export const mudAliasSchema = z.object({
  alias: z.string().min(1),
  expansion: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const mudTriggerSchema = z.object({
  pattern: z.string().min(1),
  response: z.string().min(1),
  enabled: z.boolean().default(true),
  isRegex: z.boolean().default(false),
});

// MUD client types
export type MudProfile = typeof mudProfiles.$inferSelect;
export type InsertMudProfile = z.infer<typeof insertMudProfileSchema>;
export type MudSession = typeof mudSessions.$inferSelect;
export type InsertMudSession = z.infer<typeof insertMudSessionSchema>;
export type MudAlias = z.infer<typeof mudAliasSchema>;
export type MudTrigger = z.infer<typeof mudTriggerSchema>;
