
import { storage } from "./storage";
import { db } from "./db";
import { documents } from "@shared/schema";
import { isNull, eq } from "drizzle-orm";

/**
 * Migrate all documents to a specific user
 * This will migrate documents with null userId OR documents belonging to other users
 */
export async function migrateDocumentsToUser(targetUserId: string) {
  try {
    console.log(`🔄 Starting document migration to user: ${targetUserId}`);

    // Get all documents (regardless of userId)
    const allDocs = await db
      .select()
      .from(documents);

    console.log(`📚 Found ${allDocs.length} total documents in database`);

    // Filter documents that don't belong to target user
    const docsToMigrate = allDocs.filter(doc => doc.userId !== targetUserId);
    
    console.log(`📚 Found ${docsToMigrate.length} documents to migrate (${allDocs.length - docsToMigrate.length} already belong to you)`);

    if (docsToMigrate.length === 0) {
      console.log('✅ No documents to migrate - all documents already belong to you');
      return { 
        migrated: 0, 
        total: allDocs.length,
        alreadyOwned: allDocs.length
      };
    }

    // Update all documents to target user
    const result = await db
      .update(documents)
      .set({ userId: targetUserId })
      .returning();

    console.log(`✅ Successfully migrated ${result.length} documents to user ${targetUserId}`);

    return {
      migrated: result.length,
      total: allDocs.length,
      alreadyOwned: allDocs.length - result.length,
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
