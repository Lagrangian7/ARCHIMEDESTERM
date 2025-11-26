import { storage } from "./storage";
import { db } from "./db";
import { documents } from "@shared/schema";
import { isNull, eq, or } from "drizzle-orm";

/**
 * Migrate all documents to a specific user
 * This will migrate documents with null userId OR documents with empty string userId
 */
export async function migrateDocumentsToUser(userId: string) {
  console.log(`🔄 Starting document migration for user: ${userId}`);

  // Find all documents without a userId OR with empty string userId
  const orphanedDocs = await db
    .select()
    .from(documents)
    .where(
      or(
        isNull(documents.userId),
        eq(documents.userId, '')
      )
    );

  console.log(`📊 Found ${orphanedDocs.length} orphaned documents to migrate`);

  if (orphanedDocs.length === 0) {
    console.log(`✅ No documents need migration`);
    return {
      migrated: 0,
      skipped: 0,
      total: 0
    };
  }

  // Update all orphaned documents to belong to this user - do it in one query
  try {
    const result = await db
      .update(documents)
      .set({ userId })
      .where(
        or(
          isNull(documents.userId),
          eq(documents.userId, '')
        )
      );

    console.log(`✅ Migration complete: ${orphanedDocs.length} documents now assigned to user ${userId}`);

    return {
      migrated: orphanedDocs.length,
      skipped: 0,
      total: orphanedDocs.length
    };
  } catch (error) {
    console.error(`❌ Migration failed:`, error);
    throw error;
  }
}