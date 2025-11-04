
import { storage } from "./storage";
import { db } from "./db";
import { documents } from "@shared/schema";
import { isNull, eq } from "drizzle-orm";

/**
 * Migrate all documents with null userId to a specific user
 * This is a one-time migration script
 */
export async function migrateDocumentsToUser(targetUserId: string) {
  try {
    console.log(`🔄 Starting document migration to user: ${targetUserId}`);

    // Get all documents with null userId
    const nullUserDocs = await db
      .select()
      .from(documents)
      .where(isNull(documents.userId));

    console.log(`📚 Found ${nullUserDocs.length} documents with null userId`);

    if (nullUserDocs.length === 0) {
      console.log('✅ No documents to migrate');
      return { migrated: 0, total: 0 };
    }

    // Update all null userId documents to target user
    const result = await db
      .update(documents)
      .set({ userId: targetUserId })
      .where(isNull(documents.userId))
      .returning();

    console.log(`✅ Successfully migrated ${result.length} documents to user ${targetUserId}`);

    return {
      migrated: result.length,
      total: nullUserDocs.length,
      documents: result.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        mimeType: doc.mimeType
      }))
    };
  } catch (error) {
    console.error('❌ Error migrating documents:', error);
    throw error;
  }
}
