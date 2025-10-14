import { storage } from './storage';
import { llmService } from './llm-service';

const ARCHIMEDES_BOT_ID = 'archimedes-ai-bot';

export const archimedesBotService = {
  
  /**
   * Initialize the Archimedes AI bot user in the database
   */
  async initializeBot() {
    try {
      // Check if bot already exists
      const existingBot = await storage.getUser(ARCHIMEDES_BOT_ID);
      
      if (!existingBot) {
        // Create the bot user
        await storage.upsertUser({
          id: ARCHIMEDES_BOT_ID,
          email: 'archimedes@ai.terminal',
          firstName: 'Archimedes',
          lastName: 'AI',
          profileImageUrl: '/attached_assets/archy111_1760233943010.jpeg',
        });
        
        console.log('✅ Archimedes AI bot initialized');
      }
      
      // Ensure bot has presence record and is always "online"
      await storage.updateUserPresence?.(ARCHIMEDES_BOT_ID, true, 'bot-connection');
      
    } catch (error) {
      console.error('Error initializing Archimedes bot:', error);
    }
  },

  /**
   * Get the bot ID
   */
  getBotId() {
    return ARCHIMEDES_BOT_ID;
  },

  /**
   * Check if a user ID is the bot
   */
  isBot(userId: string) {
    return userId === ARCHIMEDES_BOT_ID;
  },

  /**
   * Generate AI response to a message sent to the bot
   */
  async generateResponse(userMessage: string, conversationHistory: any[] = []) {
    try {
      // Build conversation context for the AI (last 10 messages)
      const context = conversationHistory.slice(-10).map(msg => ({
        role: (msg.fromUserId === ARCHIMEDES_BOT_ID ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.content,
        timestamp: msg.sentAt,
        mode: 'natural' as 'natural' | 'technical'
      }));

      // Generate response using natural mode personality
      const response = await llmService.generateResponse(
        userMessage, 
        'natural',
        context
      );
      
      return response;
    } catch (error) {
      console.error('Error generating bot response:', error);
      return 'I apologize, but I encountered an error processing your message. Please try again.';
    }
  }
};
