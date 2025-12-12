
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, sessions } from "../shared/schema";
import crypto from "crypto";
import bcrypt from "bcrypt";
import type { RequestHandler } from "express";

// Generate secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create magic link token
export async function createMagicLink(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store token in database (you'll need to add a magicLinks table)
  // For now, we'll use a simple in-memory store
  magicLinkStore.set(token, { email, expires });
  
  return token;
}

// In-memory store for magic links (use Redis or DB in production)
const magicLinkStore = new Map<string, { email: string; expires: Date }>();

// Session store
const sessionStore = new Map<string, { userId: number; expires: Date }>();

// Verify magic link
export async function verifyMagicLink(token: string): Promise<string | null> {
  const data = magicLinkStore.get(token);
  
  if (!data || data.expires < new Date()) {
    magicLinkStore.delete(token);
    return null;
  }
  
  magicLinkStore.delete(token);
  return data.email;
}

// Create session
export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  sessionStore.set(token, { userId, expires });
  
  return token;
}

// Verify session
export async function verifySession(token: string): Promise<number | null> {
  const session = sessionStore.get(token);
  
  if (!session || session.expires < new Date()) {
    sessionStore.delete(token);
    return null;
  }
  
  return session.userId;
}

// Middleware to require authentication
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies.session_token;
  
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const userId = await verifySession(token);
  
  if (!userId) {
    res.clearCookie('session_token');
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  req.user = user;
  next();
};

// Send magic link email (integrate with your email service)
export async function sendMagicLinkEmail(email: string, token: string, domain: string) {
  const link = `https://${domain}/api/auth/verify?token=${token}`;
  
  // TODO: Integrate with email service (SendGrid, Mailgun, AWS SES, etc.)
  console.log(`Magic link for ${email}: ${link}`);
  
  // For development, just log the link
  // In production, send actual email
}
