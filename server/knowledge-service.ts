import { storage } from "./storage";
import type { Document, InsertDocument, KnowledgeChunk } from "@shared/schema";

export class KnowledgeService {
  private readonly CHUNK_SIZE = 1000; // Characters per chunk
  private readonly CHUNK_OVERLAP = 200; // Overlap between chunks

  /**
   * Process and store a text document, splitting it into searchable chunks
   */
  async processDocument(content: string, metadata: {
    userId: string | null;
    fileName: string;
    originalName: string;
    fileSize: string;
    mimeType: string;
  }): Promise<Document> {
    // Extract keywords and generate summary
    const keywords = this.extractKeywords(content);
    const summary = this.generateSummary(content);

    // Create document record
    const document = await storage.createDocument({
      userId: metadata.userId,
      fileName: metadata.fileName,
      originalName: metadata.originalName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      content,
      summary,
      keywords,
    });

    // Split content into chunks for better search
    await this.createKnowledgeChunks(document.id, content);

    return document;
  }

  /**
   * Split text content into overlapping chunks for better context preservation
   */
  private async createKnowledgeChunks(documentId: string, content: string): Promise<void> {
    const chunks = this.chunkText(content);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await storage.createKnowledgeChunk({
        documentId,
        chunkIndex: i.toString(),
        content: chunk,
        wordCount: chunk.split(/\s+/).length.toString(),
      });
    }
  }

  /**
   * Split text into chunks with overlap for context preservation
   */
  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + this.CHUNK_SIZE;
      
      // If we're not at the end, try to break at word boundary
      if (endIndex < text.length) {
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + this.CHUNK_SIZE * 0.7) {
          endIndex = lastSpace;
        }
      }

      chunks.push(text.slice(startIndex, endIndex).trim());
      
      // Move start position with overlap
      startIndex = Math.max(startIndex + this.CHUNK_SIZE - this.CHUNK_OVERLAP, endIndex);
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Extract keywords from text content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, you might use NLP libraries
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Get top keywords by frequency, excluding common stop words
    const stopWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 
      'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 
      'such', 'take', 'than', 'them', 'well', 'were', 'what', 'your'
    ]);

    return Object.entries(wordFreq)
      .filter(([word]) => !stopWords.has(word))
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Generate a summary of the text content
   */
  private generateSummary(content: string): string {
    // Simple extractive summary - get first few sentences
    const sentences = content
      .replace(/\s+/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    if (sentences.length === 0) return content.slice(0, 200);
    
    const summary = sentences.slice(0, 3).join('. ').trim();
    return summary.length > 200 ? summary.slice(0, 200) + '...' : summary;
  }

  /**
   * Search for relevant knowledge based on a query
   */
  async searchKnowledge(userId: string, query: string): Promise<{
    documents: Document[];
    chunks: KnowledgeChunk[];
    relevantContent: string[];
  }> {
    const [documents, chunks] = await Promise.all([
      storage.searchDocuments(userId, query),
      storage.searchKnowledgeChunks(userId, query),
    ]);

    // Extract most relevant content snippets
    const relevantContent = chunks
      .map(chunk => this.extractRelevantSnippet(chunk.content, query))
      .filter(snippet => snippet.length > 0)
      .slice(0, 5); // Limit to top 5 most relevant snippets

    return {
      documents,
      chunks,
      relevantContent,
    };
  }

  /**
   * Extract a relevant snippet around the query match
   */
  private extractRelevantSnippet(content: string, query: string): string {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);
    
    if (index === -1) return '';

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);
    
    let snippet = content.slice(start, end);
    
    // Add ellipsis if we truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Get contextual knowledge for AI responses
   */
  async getContextualKnowledge(userId: string, query: string, limit: number = 3): Promise<string> {
    const searchResults = await this.searchKnowledge(userId, query);
    
    if (searchResults.relevantContent.length === 0) {
      return '';
    }

    const context = searchResults.relevantContent
      .slice(0, limit)
      .map((content, index) => `[Reference ${index + 1}]: ${content}`)
      .join('\n\n');

    return `Based on your uploaded documents:\n\n${context}`;
  }

  /**
   * Delete a document and all its associated chunks
   */
  async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    const document = await storage.getDocument(documentId);
    if (!document || document.userId !== userId) {
      return false;
    }

    await storage.deleteDocument(documentId);
    return true;
  }

  /**
   * Get document statistics for a user
   */
  async getUserDocumentStats(userId: string): Promise<{
    totalDocuments: number;
    totalSizeBytes: number;
    totalChunks: number;
    recentDocuments: Document[];
  }> {
    const documents = await storage.getUserDocuments(userId);
    const totalSizeBytes = documents.reduce((sum, doc) => sum + parseInt(doc.fileSize), 0);
    
    let totalChunks = 0;
    for (const doc of documents) {
      const chunks = await storage.getDocumentChunks(doc.id);
      totalChunks += chunks.length;
    }

    return {
      totalDocuments: documents.length,
      totalSizeBytes,
      totalChunks,
      recentDocuments: documents.slice(0, 5),
    };
  }
}

export const knowledgeService = new KnowledgeService();