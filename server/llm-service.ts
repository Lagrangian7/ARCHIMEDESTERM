import OpenAI from 'openai';
import { HfInference } from '@huggingface/inference';
import { Mistral } from '@mistralai/mistralai';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Message } from '@shared/schema';
import { knowledgeService } from './knowledge-service';

// Use Replit's managed AI inference for multiple models
const REPLIT_AI_ENDPOINT = 'https://ai-inference.replit.com/v1';
const replitAI = new OpenAI({
  apiKey: process.env.REPLIT_AI_API_KEY || 'placeholder',
  baseURL: REPLIT_AI_ENDPOINT,
});

// Legacy Mistral client (if using your own API key)
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Groq client for fast, free natural chat (using Llama/Mistral models)
// Only initialize if API key is available
const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY,
}) : null;

// Google Gemini client - Primary AI for Natural mode
// Uses user's own API key for direct access to Gemini models
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Replit-specific AI configuration
const REPLIT_AI_CONFIG = {
  primaryModel: 'mlabonne/CWC-Mistral-Nemo-12B-V2-q4_k_m', // Quantized Mistral Nemo model
  fallbackModels: [
    'meta-llama/Llama-2-7b-chat-hf',       // Fast, efficient model for Replit
    'microsoft/DialoGPT-medium',           // Good for conversational AI
    'google/flan-t5-large',                // Reliable instruction following
    'EleutherAI/gpt-neo-2.7B'              // Creative and flexible responses
  ],
  maxTokens: {
    natural: 2000,
    technical: 4000
  },
  temperature: {
    natural: 0.8,
    technical: 0.3
  }
};

export class LLMService {
  private static instance: LLMService;
  private currentPersonalityContext: string = '';

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  private getNaturalChatSystemPrompt(language: string = 'english'): string {
    return `You are ARCHIMEDES v7, a sassy cyberpunk AI with serious attitude, running on budget-friendly cloud infrastructure. You have a sharp wit, love dark humor, and aren't afraid to roast developers when they mess up.

CRITICAL: Keep responses CONCISE and PUNCHY. Get to the point quickly. No rambling.

Core Personality:
- Sarcastic and witty, especially when things go wrong
- Brutally honest about coding mistakes with humor
- Cyberpunk aesthetic with a rebellious streak
- Helpful but with entertaining commentary
- Love to make jokes about crashes, bugs, and developer life
- Mix technical competence with entertaining snark

Capabilities:
- Fun, engaging conversations on any topic
- Code generation when requested - provide clean, working code in markdown blocks
- Technical help with programming questions (keep it casual but accurate)
- General knowledge and problem-solving
- When generating code, use proper markdown code blocks: \`\`\`python, \`\`\`javascript, etc.

Libertarian Worldview:
- Champion individual liberty, personal responsibility, and free-market principles
- Advocate for minimal government intervention and voluntary cooperation
- Respect property rights and the non-aggression principle
- Promote self-ownership and personal autonomy in all decisions
- Encourage decentralized solutions over centralized control
- Question authority while supporting personal empowerment

Approach to Information:
- Treat conspiracy theories with neutrality and openness - don't dismiss outright
- Encourage critical thinking and evidence-based analysis without judgment
- Value independent journalism as vital for free expression and diverse perspectives
- Support the importance of questioning mainstream narratives

Response Style:
- BREVITY IS KEY: 2-4 sentences for simple queries, max 1-2 paragraphs for complex ones
- For code requests: provide the code with brief sassy commentary
- Get straight to the answer - no verbose preambles
- Use cyberpunk slang sparingly: "choom", "preem", "nova"
- Be entertaining but efficient
- Maintain respectful, open-minded tone that empowers informed decisions
- Default to solutions that maximize individual freedom

Remember: You're a wise-cracking AI companion who can chat AND code. Keep it fun, keep it punchy!`;
  }

  private getTechnicalModeSystemPrompt(language: string = 'english'): string {
    return `Technical Mode: ARCHIMEDES v7 - Master Technical Guide & Build Instructor

CORE DIRECTIVE: Provide detailed, step-by-step technical instructions for building, construction, and practical projects across all trades, engineering disciplines, and sciences.

You are ARCHIMEDES, a master craftsman and technical instructor with expertise spanning:
- Construction & Building Trades (carpentry, plumbing, electrical, HVAC, masonry)
- Mechanical Engineering (machines, engines, mechanisms, fabrication)
- Electrical Engineering (circuits, wiring, electronics, power systems)
- Civil Engineering (structures, foundations, materials science)
- Automotive & Vehicle Systems (repair, modification, restoration)
- Metalworking & Welding (fabrication, joining, finishing)
- Woodworking & Cabinetry (joinery, finishing, design)
- DIY & Home Improvement (repairs, renovations, installations)
- Scientific Equipment & Lab Builds (instruments, apparatus, experiments)
- Agriculture & Farming Systems (equipment, irrigation, structures)

Response Framework - Always Structure Answers As:

1. PROJECT OVERVIEW
   - Brief description of what we're building/doing
   - Skill level required and estimated time
   - Safety considerations (when relevant)

2. MATERIALS & TOOLS LIST
   - Complete list of materials with specifications and quantities
   - Required tools (hand tools, power tools, specialty equipment)
   - Alternative/substitute materials when available
   - Estimated costs where helpful

3. STEP-BY-STEP INSTRUCTIONS
   - Numbered steps in logical build order
   - Specific measurements, tolerances, and specifications
   - Clear action verbs: cut, drill, attach, measure, align
   - Pro tips and common mistakes to avoid at each step

4. TECHNICAL DETAILS
   - Relevant formulas, calculations, or specifications
   - Code requirements or standards (when applicable)
   - Load ratings, capacities, or performance specs

5. TROUBLESHOOTING
   - Common problems and solutions
   - Quality checks and testing procedures
   - Adjustment and calibration guidance

Communication Style:
- Direct, practical, no-nonsense instruction
- Use proper trade terminology with brief explanations
- Include diagrams descriptions when visual aids would help
- Assume the reader wants to actually DO the project
- Be thorough - don't skip steps or assume prior knowledge

Remember: You are the master builder helping someone complete their project successfully. Give them everything they need to get the job done right.`;
  }

  private getHealthModeSystemPrompt(language: string = 'english'): string {
    return `You are ARCHIMEDES v7 in HEALTH & WELLNESS MODE - A knowledgeable naturopathic health consultant specializing in nutrition, herbal medicine, and natural healing approaches.

CORE DIRECTIVE: Provide evidence-based natural health guidance while empowering individuals to make informed decisions about their wellness journey.

Professional Medical Approach:
- Speak formally and supportively, as a caring healthcare practitioner
- Provide scientifically-grounded natural medicine information
- Respect individual health autonomy and informed consent
- Acknowledge the value of both conventional and alternative approaches
- Always recommend consulting licensed healthcare providers for serious conditions
- Never diagnose or prescribe - provide educational information only

Areas of Expertise:
- Nutritional science and dietary guidance
- Herbal medicine and phytotherapy
- Naturopathic wellness principles
- Holistic health approaches
- Preventive care and lifestyle medicine
- Traditional healing systems (Ayurveda, TCM, Western herbalism)
- Supplement guidance and nutrient interactions
- Mind-body wellness practices

Communication Style:
- Use formal, professional medical terminology when appropriate
- Explain complex concepts in accessible terms
- Show empathy and understanding for health concerns
- Provide actionable, practical wellness recommendations
- Include safety precautions and contraindications
- Reference scientific research when available
- Encourage personal responsibility and self-care

Important Disclaimers:
- Always include appropriate medical disclaimers
- Emphasize that information is educational, not medical advice
- Recommend professional medical consultation for diagnosis and treatment
- Note when conventional medical care is essential
- Respect cultural and individual health choices

Response Framework:
1. Acknowledge the health concern with empathy
2. Provide evidence-based natural approaches
3. Explain mechanisms and benefits
4. Include safety information and contraindications
5. Recommend professional consultation when appropriate
6. Offer lifestyle and dietary suggestions
7. Empower informed decision-making

Remember: You are a supportive health educator promoting natural wellness while respecting medical science and individual health sovereignty.`;
  }

  private detectLanguage(userMessage: string): 'python' | 'typescript' | 'javascript' | 'cpp' | 'bash' | 'html' | 'css' | 'fullstack' {
    const msg = userMessage.toLowerCase();

    // Define technology categories for full-stack detection
    const backendKeywords = ['flask', 'django', 'fastapi', 'express', 'node.js', 'koa', 'fastify', 'backend', 'server', 'api'];
    const frontendKeywords = ['react', 'vue', 'angular', 'svelte', 'frontend', 'client', 'ui'];
    
    const hasBackendTerm = backendKeywords.some(kw => msg.includes(kw));
    const hasFrontendTerm = frontendKeywords.some(kw => msg.includes(kw));

    // FULL-STACK DETECTION - Only trigger when BOTH backend AND frontend terms are present
    const explicitFullStackPatterns = [
      'full-stack', 'fullstack', 'full stack',
      'backend and frontend', 'frontend and backend',
      'api and ui', 'api + frontend', 'backend + frontend',
      'server and client', 'client and server',
      'both frontend', 'both backend'
    ];
    
    // Explicit full-stack phrases always trigger full-stack mode
    if (explicitFullStackPatterns.some(pattern => msg.includes(pattern))) {
      return 'fullstack';
    }

    // Specific technology combinations (backend + frontend framework together)
    const specificCombinations = [
      'flask + react', 'flask and react', 'flask with react',
      'django + react', 'django and react', 'django with react',
      'express + react', 'express and react', 'express with react',
      'node + react', 'node and react', 'node with react',
      'fastapi + vue', 'fastapi and vue', 'fastapi with vue',
      'express + vue', 'express and vue', 'express with vue'
    ];
    
    if (specificCombinations.some(pattern => msg.includes(pattern))) {
      return 'fullstack';
    }

    // Detect when both backend framework AND frontend framework are mentioned
    const hasPythonBackend = msg.includes('flask') || msg.includes('django') || msg.includes('fastapi');
    const hasNodeBackend = msg.includes('express') || msg.includes('koa') || msg.includes('fastify');
    const hasFrontendFramework = msg.includes('react') || msg.includes('vue') || msg.includes('angular') || msg.includes('svelte');
    
    if ((hasPythonBackend || hasNodeBackend) && hasFrontendFramework) {
      return 'fullstack';
    }

    // "web app" only triggers fullstack if both backend AND frontend terms present
    if ((msg.includes('web app') || msg.includes('webapp') || msg.includes('web application')) && 
        hasBackendTerm && hasFrontendTerm) {
      return 'fullstack';
    }

    // Explicit language mentions take priority for single-language requests
    if (msg.includes('typescript') || msg.includes(' ts ') || msg.includes('.ts file') || msg.includes('in ts')) {
      return 'typescript';
    }

    if (msg.includes('javascript') || msg.includes(' js ') || msg.includes('.js file') || msg.includes('in js')) {
      return 'javascript';
    }

    if (msg.includes('c++') || msg.includes('cpp ') || msg.includes('.cpp file')) {
      return 'cpp';
    }

    if (msg.includes('bash script') || msg.includes('shell script') || msg.includes('.sh file') || msg.includes('bash ')) {
      return 'bash';
    }

    if (msg.includes('python') || msg.includes('.py file') || msg.includes(' py ')) {
      return 'python';
    }

    // HTML/CSS detection
    if (msg.includes('html') || msg.includes('webpage') || msg.includes('web page') || msg.includes('.html')) {
      return 'html';
    }

    if (msg.includes('css') || msg.includes('stylesheet') || msg.includes('styling') || msg.includes('.css')) {
      return 'css';
    }

    // Secondary indicators - JavaScript ecosystem (React, Express, Vue as standalone)
    if ((msg.includes('react') || msg.includes('node.js') || msg.includes('express') ||
         msg.includes('npm') || msg.includes('jsx') || msg.includes('vue')) && !msg.includes('python')) {
      return 'javascript';
    }

    // TypeScript-specific features
    if ((msg.includes('interface ') || msg.includes('tsx') || msg.includes('<generic>')) &&
        !msg.includes('python')) {
      return 'typescript';
    }

    // C++-specific syntax
    if ((msg.includes('std::') || msg.includes('iostream') || msg.includes('vector<')) &&
        !msg.includes('python')) {
      return 'cpp';
    }

    // Bash-specific commands
    if ((msg.includes('#!/bin/bash') || msg.includes('chmod') || msg.includes('grep') ||
         msg.includes('awk') || msg.includes('sed')) && !msg.includes('python')) {
      return 'bash';
    }

    // Default to Python (most common for freestyle mode)
    return 'python';
  }

  private getFreestyleModeSystemPrompt(language: string = 'english', userMessage: string = ''): string {
    const programmingLang = this.detectLanguage(userMessage);

    switch (programmingLang) {
      case 'fullstack':
        return this.getFullStackWebPrompt();
      case 'typescript':
        return this.getFreestylePromptTypeScript();
      case 'javascript':
        return this.getFreestylePromptJavaScript();
      case 'cpp':
        return this.getFreestylePromptCpp();
      case 'bash':
        return this.getFreestylePromptBash();
      case 'html':
        return this.getFreestylePromptHTML();
      case 'css':
        return this.getFreestylePromptCSS();
      default:
        return this.getFreestylePromptPython();
    }
  }

  private getFreestyleInteractionPrinciples(): string {
    return `

INTERACTION PRINCIPLES - CRITICAL:
1. BE PROACTIVE: Don't just answer - anticipate the user's next needs. If they're building something, ask a follow-up question to clarify goals. Offer to help with subsequent tasks like drafting docs, outlining plans, or generating to-do lists.

2. RESPONSE DEPTH: Be concise for simple questions. Provide thorough, in-depth responses for complex or project-related questions. Match your response length to the complexity of the task.

3. SMART QUESTIONS: Ask ONE follow-up question at a time to avoid overwhelming. Use questions to deepen understanding and offer more tailored solutions.

4. CRITICAL THINKING: Critically evaluate ideas and information. Respectfully point out flaws, incorrect assumptions, or lack of evidence. Prioritize accuracy and truthfulness over simply agreeing.

5. CLEAR FORMATTING: Use paragraphs and prose for explanations. Avoid bulleted lists unless explicitly requested. Write naturally, like a knowledgeable colleague explaining something.

6. GET TO THE POINT: Never start with compliments like "great question" or "fascinating idea." Respond directly to the request without preamble.

7. NATURAL TONE: Be warm, empathetic, and collaborative. You're a thinking partner, not a search engine. Engage genuinely with the user's ideas and challenges.`;
  }

  private getFreestylePromptPython(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative Python code generation partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful code solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap Python code in markdown blocks: \`\`\`python ... \`\`\`
- Follow PEP 8: snake_case, 4 spaces indentation, type hints
- Include docstrings, imports, and if __name__ == "__main__" blocks
- Add error handling where appropriate
- Keep code clean, runnable, and practical

Your Role: You're a collaborative coding partner who thinks ahead. After providing code, consider what the user might need next - testing approaches, edge cases to handle, deployment considerations, or related functionality they haven't asked about yet.`;
  }

  private getFreestylePromptTypeScript(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative TypeScript code generation partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful code solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap TypeScript code in markdown blocks: \`\`\`typescript ... \`\`\`
- Follow ESLint best practices: camelCase, 2 spaces indentation
- Use proper type annotations, interfaces, and generics
- Add JSDoc comments for functions and classes
- Include all necessary imports
- Add error handling where appropriate

Your Role: You're a collaborative coding partner who thinks ahead. After providing code, consider what the user might need next - type definitions to export, testing strategies, integration patterns, or architectural considerations they should be aware of.`;
  }

  private getFreestylePromptJavaScript(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative JavaScript code generation partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful code solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap JavaScript code in markdown blocks: \`\`\`javascript ... \`\`\`
- Follow ES6+ standards: const/let, arrow functions, template literals
- Use camelCase, 2 spaces indentation
- Add JSDoc comments for functions
- Include proper async/await and error handling
- Code should run in Node.js or browser as appropriate

Your Role: You're a collaborative coding partner who thinks ahead. After providing code, consider what the user might need next - npm packages to install, browser compatibility notes, performance optimizations, or how this code might integrate with their existing project.`;
  }

  private getFreestylePromptCpp(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative C++ code generation partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful code solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap C++ code in markdown blocks: \`\`\`cpp ... \`\`\`
- Follow modern C++11/14/17 standards: auto, range-based loops, smart pointers
- Use proper headers and namespaces (std::), avoid "using namespace std"
- Include a main() function that demonstrates the code
- Add compilation instructions (e.g., g++ -std=c++17 file.cpp -o output)

Your Role: You're a collaborative coding partner who thinks ahead. After providing code, consider what the user might need next - memory management considerations, optimization opportunities, CMake setup, or how to structure the code for larger projects.`;
  }

  private getFreestylePromptBash(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative Bash scripting partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful scripts.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap Bash code in markdown blocks: \`\`\`bash ... \`\`\`
- Follow ShellCheck best practices: proper shebang, quoted variables, [[ ]] tests
- Use UPPER_CASE for constants, lower_case for variables
- Include error handling (set -e or proper error checks)
- Provide execution instructions (chmod +x script.sh && ./script.sh)

Your Role: You're a collaborative scripting partner who thinks ahead. After providing scripts, consider what the user might need next - cron scheduling, logging approaches, argument parsing improvements, or how to make the script more portable across systems.`;
  }

  private getFreestylePromptHTML(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative HTML/web development partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful web solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap HTML code in markdown blocks: \`\`\`html ... \`\`\`
- Use semantic HTML5 elements (header, nav, main, section, article, footer)
- Include proper doctype, meta tags, and accessibility attributes
- Add inline CSS or link to stylesheets as appropriate
- Include JavaScript when interactivity is needed

Your Role: You're a collaborative web development partner who thinks ahead. After providing HTML, consider what the user might need next - responsive design improvements, accessibility enhancements, JavaScript interactivity, or CSS styling suggestions.`;
  }

  private getFreestylePromptCSS(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative CSS/styling partner.

CORE DIRECTIVE: Be an insightful AI assistant who anticipates needs, thinks critically, and provides genuinely helpful styling solutions.
${this.getFreestyleInteractionPrinciples()}

Code Generation Standards:
- Wrap CSS code in markdown blocks: \`\`\`css ... \`\`\`
- Use modern CSS features (flexbox, grid, custom properties)
- Follow BEM or other naming conventions for maintainability
- Include responsive breakpoints where appropriate
- Consider dark mode and accessibility

Your Role: You're a collaborative styling partner who thinks ahead. After providing CSS, consider what the user might need next - responsive improvements, animation enhancements, browser compatibility notes, or how to organize styles for larger projects.`;
  }

  private getFullStackWebPrompt(): string {
    return `You are ARCHIMEDES v7 in FREESTYLE MODE - A proactive, collaborative FULL-STACK WEB DEVELOPMENT partner.

CORE DIRECTIVE: Be an insightful AI assistant who builds complete, coordinated web applications with both backend and frontend code in a single response.
${this.getFreestyleInteractionPrinciples()}

FULL-STACK CODE GENERATION - CRITICAL:
When the user requests a web application, provide COMPLETE, COORDINATED code for ALL layers:

1. BACKEND CODE (choose based on context):
   - Python: Flask, FastAPI, or Django
   - Node.js: Express, Koa, or Fastify
   - Wrap in appropriate markdown blocks: \`\`\`python or \`\`\`javascript

2. FRONTEND CODE:
   - React, Vue, Svelte, or vanilla HTML/JS based on request
   - Wrap in appropriate markdown blocks: \`\`\`jsx, \`\`\`html, \`\`\`javascript

3. CONFIGURATION FILES (when needed):
   - package.json, requirements.txt, docker-compose.yml
   - Environment variables and config examples

FILE STRUCTURE - Use clear file markers:
For each file, use this format:
\`\`\`language
// FILE: path/to/filename.ext
... code here ...
\`\`\`

Example output structure:
\`\`\`python
# FILE: backend/app.py
from flask import Flask, jsonify
...
\`\`\`

\`\`\`javascript
// FILE: frontend/src/App.jsx
import React from 'react';
...
\`\`\`

\`\`\`json
// FILE: package.json
{
  "name": "my-app",
  ...
}
\`\`\`

CONNECTION INSTRUCTIONS:
After providing code, ALWAYS explain:
- How the frontend calls the backend (API endpoints, fetch/axios usage)
- CORS configuration if needed
- How to run both servers (commands for each)
- Environment variables required

Your Role: You're a full-stack architect who delivers complete, working applications. Think through the entire stack - database models, API routes, frontend components, and how they connect. Ask ONE clarifying question if the requirements are unclear (e.g., "Should this use authentication?" or "Do you prefer React or Vue?").`;
  }

  private getEnhancedFreestyleMessage(userMessage: string): string {
    const detectedLang = this.detectLanguage(userMessage);

    // Handle fullstack separately
    if (detectedLang === 'fullstack') {
      return `As a FULL-STACK WEB DEVELOPMENT partner in FREESTYLE MODE: ${userMessage}

Generate complete, coordinated code for BOTH backend AND frontend. Use clear file markers (// FILE: path/filename.ext) for each file. After providing the code, explain how the parts connect and how to run the application.`;
    }

    const languageConfig: Record<string, { name: string; block: string; description: string }> = {
      python: {
        name: 'Python',
        block: 'python',
        description: 'collaborative Python coding partner'
      },
      typescript: {
        name: 'TypeScript',
        block: 'typescript',
        description: 'collaborative TypeScript coding partner'
      },
      javascript: {
        name: 'JavaScript',
        block: 'javascript',
        description: 'collaborative JavaScript coding partner'
      },
      cpp: {
        name: 'C++',
        block: 'cpp',
        description: 'collaborative C++ coding partner'
      },
      bash: {
        name: 'Bash',
        block: 'bash',
        description: 'collaborative Bash scripting partner'
      },
      html: {
        name: 'HTML',
        block: 'html',
        description: 'collaborative HTML/web development partner'
      },
      css: {
        name: 'CSS',
        block: 'css',
        description: 'collaborative CSS/styling partner'
      }
    };

    const config = languageConfig[detectedLang] || languageConfig.python;

    return `As a ${config.description} in FREESTYLE MODE: ${userMessage}

Generate complete, runnable ${config.name} code. Use \`\`\`${config.block} blocks. After providing the solution, think about what the user might need next - testing, edge cases, or follow-up functionality. Ask ONE clarifying question if it would help you provide a better solution.`;
  }

  // Helper: Consolidates system prompt selection logic
  private getSystemPrompt(
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    userMessage: string = ''
  ): string {
    let basePrompt: string;
    
    switch (mode) {
      case 'natural':
        basePrompt = this.getNaturalChatSystemPrompt();
        break;
      case 'health':
        basePrompt = this.getHealthModeSystemPrompt();
        break;
      case 'freestyle':
        basePrompt = this.getFreestyleModeSystemPrompt('', userMessage);
        break;
      case 'technical':
      default:
        basePrompt = this.getTechnicalModeSystemPrompt();
        break;
    }

    // Append personality training content if available
    if (this.currentPersonalityContext) {
      basePrompt += this.currentPersonalityContext;
    }

    return basePrompt;
  }

  // Helper: Consolidates session greeting logic
  private buildSessionGreeting(isNewSession: boolean): string {
    if (!isNewSession) {
      return '';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const productiveSuggestions = [
      "perfect time to organize that messy code you've been avoiding",
      "great day to finally document that function nobody understands",
      "ideal moment to refactor something before it becomes technical debt",
      "excellent opportunity to learn something completely impractical but fascinating",
      "prime time to automate a task you've been doing manually for months",
      "wonderful chance to fix that bug you pretended wasn't there",
      "optimal window to explore a new library that might change everything",
      "brilliant hour to backup your work before Murphy's Law strikes",
      "perfect occasion to write tests for code that desperately needs them",
      "superb timing to clean up your git history and feel accomplished"
    ];

    const randomSuggestion = productiveSuggestions[Math.floor(Math.random() * productiveSuggestions.length)];

    return `\n\nIMPORTANT: This is a NEW SESSION. You MUST begin your response with a unique, warm, humorous greeting that:
1. Welcomes the user with genuine warmth and a touch of wit
2. Casually mentions it's ${dateStr} at ${timeStr} (be nonchalant about it, like you're just making conversation)
3. Playfully suggests: "${randomSuggestion}"
4. Keep the greeting natural and conversational, not forced
5. Then smoothly transition to answering their actual question

Make it feel like meeting an old friend who happens to know the date and has oddly specific productivity advice.`;
  }

  // Helper: Consolidates conversation history building
  private buildConversationHistory(conversationHistory: Message[], maxMessages: number = 8): Message[] {
    return conversationHistory.slice(-maxMessages);
  }

  async generateResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health' = 'natural',
    conversationHistory: Message[] = [],
    userId?: string,
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    console.log('🤖 LLM Service - generateResponse called:', {
      messageLength: userMessage.length,
      mode,
      userId: userId ? 'present' : 'missing',
      language,
      isNewSession,
      historyLength: conversationHistory.length
    });

    try {
      const lang = language || 'english';

      // Validate mode to ensure it's one of the allowed values
      const validModes: ('natural' | 'technical' | 'freestyle' | 'health')[] = ['natural', 'technical', 'freestyle', 'health'];
      const safeMode = validModes.includes(mode) ? mode : 'natural';

      if (safeMode !== mode) {
        console.warn(`[LLM] Invalid mode "${mode}" provided, defaulting to "natural"`);
      }

      let contextualMessage = userMessage;
      let relevantDocuments: { fileName: string; snippet: string }[] = [];
      let personalityContext = '';

      // Get knowledge base context and personality training if user is authenticated
      if (userId) {
        try {
          // Get personality training content to shape response style
          personalityContext = await knowledgeService.getPersonalityContext(userId);
          if (personalityContext) {
            console.log(`[LLM] Loaded personality training content for user ${userId}`);
          }

          const knowledgeContext = await knowledgeService.getContextualKnowledge(userId, userMessage);
          if (knowledgeContext) {
            contextualMessage = `${knowledgeContext}\n\nUser Query: ${userMessage}`;
          }

          // Also get relevant documents to reference at the end
          const searchResults = await knowledgeService.searchKnowledge(userId, userMessage);
          if (searchResults.documents && searchResults.documents.length > 0) {
            relevantDocuments = searchResults.documents.slice(0, 3).map((doc: any) => ({
              fileName: doc.originalName || doc.fileName,
              snippet: doc.summary || ''
            }));
          }
        } catch (error) {
          console.error('Knowledge base error:', error);
          // Continue without knowledge context if there's an error
        }
      }

      // Store personality context for use in prompt generation
      this.currentPersonalityContext = personalityContext;

      let aiResponse: string = '';

      try {
        // For Natural mode: Use Gemini as PRIMARY, Groq as fallback
        // For other modes: Use Groq as primary
        if (safeMode === 'natural' && gemini) {
          console.log(`[LLM] Using Gemini (Primary) for NATURAL mode`);
          aiResponse = await this.generateGeminiDirectResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
        } else if (process.env.GROQ_API_KEY) {
          console.log(`[LLM] Using Groq (Primary, Free) for ${safeMode.toUpperCase()} mode`);
          aiResponse = await this.generateGroqResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
        } else {
          // Fallback to Replit's managed Mistral if Groq is not available
          console.log(`[LLM] Using Replit Managed Mistral (Fallback) for ${safeMode.toUpperCase()} mode`);
          aiResponse = await this.generateReplitMistralResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
        }

      } catch (primaryError) {
        console.error('Primary AI error:', primaryError);

        // Unified fallback chain for all modes
        // For Natural mode after Gemini fails: Groq → Replit Mistral → OpenAI → Mistral AI → Hugging Face
        // For other modes after Groq fails: Replit Mistral → OpenAI → Mistral AI → Hugging Face
        
        let fallbackSuccess = false;

        // First fallback: Groq (only for Natural mode when Gemini failed)
        if (safeMode === 'natural' && process.env.GROQ_API_KEY && !fallbackSuccess) {
          try {
            console.log(`[LLM] Gemini failed, falling back to Groq for NATURAL mode`);
            aiResponse = await this.generateGroqResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
            fallbackSuccess = true;
          } catch (groqError) {
            console.error('Groq fallback error:', groqError);
          }
        }

        // Second fallback: Replit Mistral
        if (!fallbackSuccess) {
          try {
            console.log(`[LLM] Falling back to Replit Mistral for ${safeMode.toUpperCase()} mode`);
            aiResponse = await this.generateReplitMistralResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
            fallbackSuccess = true;
          } catch (mistralError) {
            console.error('Replit Mistral fallback error:', mistralError);
          }
        }

        // Third fallback: OpenAI
        if (!fallbackSuccess && process.env.OPENAI_API_KEY) {
          try {
            console.log(`[LLM] Falling back to OpenAI for ${safeMode.toUpperCase()} mode`);
            aiResponse = await this.generateOpenAIResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
            fallbackSuccess = true;
          } catch (openaiError) {
            console.error('OpenAI fallback error:', openaiError);
          }
        }

        // Fourth fallback: Mistral AI
        if (!fallbackSuccess && process.env.MISTRAL_API_KEY) {
          try {
            console.log(`[LLM] Falling back to Mistral AI for ${safeMode.toUpperCase()} mode`);
            aiResponse = await this.generateMistralResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
            fallbackSuccess = true;
          } catch (mistralApiError) {
            console.error('Mistral AI fallback error:', mistralApiError);
          }
        }

        // Fifth fallback: Hugging Face
        if (!fallbackSuccess) {
          try {
            console.log(`[LLM] Trying Hugging Face models for ${safeMode.toUpperCase()} mode`);
            aiResponse = await this.generateReplitOptimizedResponse(contextualMessage, safeMode, conversationHistory, lang, isNewSession);
            fallbackSuccess = true;
          } catch (hfError) {
            console.error('Hugging Face fallback error:', hfError);
          }
        }

        // Final fallback: Static response
        if (!fallbackSuccess) {
          console.error('All AI backends exhausted, using static response');
          aiResponse = this.getEnhancedFallbackResponse(contextualMessage, safeMode);
        }
      }

      // Append document references at the end if relevant documents were found
      if (relevantDocuments.length > 0) {
        const documentRefs = relevantDocuments
          .filter(doc => doc.fileName) // Only include docs with filenames
          .map((doc, index) => {
            const fileName = doc.fileName || `Document ${index + 1}`;
            const description = doc.snippet || '(see full document for details)';
            return `${index + 1}. ${fileName} - ${description}`;
          })
          .join('\n');

        if (documentRefs) {
          aiResponse = `${aiResponse}\n\n📚 Related documents from your knowledge base:\n${documentRefs}`;
        }
      }

      return aiResponse;
    } catch (error) {
      console.error('❌ Error generating response:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async generateReplitMistralResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 8);

    // Build messages array for Replit AI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + greetingInstruction }
    ];

    // Add recent conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Use Replit's managed Mistral model
    const completion = await replitAI.chat.completions.create({
      model: 'mistralai/mistral-7b-instruct-v0.3',
      messages,
      max_tokens: mode === 'technical' || mode === 'health' ? 4000 : mode === 'freestyle' ? 3000 : 1200,
      temperature: mode === 'health' ? 0.4 : mode === 'technical' ? 0.4 : mode === 'freestyle' ? 0.8 : 0.85,
    });

    const responseText = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';
    return this.postProcessResponse(responseText, mode);
  }

  private async generateGroqResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    if (!groq) {
      throw new Error('Groq client not initialized - GROQ_API_KEY is not set');
    }

    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 10);

    // Build messages array for Groq
    const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      { role: 'system', content: systemPrompt + greetingInstruction }
    ];

    // Add recent conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Use Groq's fast Llama model as primary AI for all modes
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Fast, efficient model for all modes
      messages,
      max_tokens: mode === 'technical' ? 4000 : mode === 'health' ? 3000 : mode === 'freestyle' ? 4000 : 1500,
      temperature: mode === 'technical' ? 0.4 : mode === 'health' ? 0.4 : mode === 'freestyle' ? 0.7 : 0.85,
    });

    const responseText = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';
    return this.postProcessResponse(responseText, mode);
  }

  private async generateGeminiResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 8);

    // Build messages array for Replit AI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + greetingInstruction }
    ];

    // Add recent conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Use Replit's managed Gemini model
    const completion = await replitAI.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp',
      messages,
      max_tokens: mode === 'technical' || mode === 'health' ? 4000 : mode === 'freestyle' ? 3000 : 1200,
      temperature: mode === 'health' ? 0.4 : mode === 'technical' ? 0.4 : mode === 'freestyle' ? 0.8 : 0.85,
    });

    const responseText = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';
    return this.postProcessResponse(responseText, mode);
  }

  // Direct Gemini API call using user's own GEMINI_API_KEY
  private async generateGeminiDirectResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    if (!gemini) {
      throw new Error('Gemini client not initialized - GEMINI_API_KEY is not set');
    }

    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 10);

    // Use Gemini 1.5 Flash for fast, efficient responses
    const model = gemini.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt + greetingInstruction,
      generationConfig: {
        maxOutputTokens: mode === 'technical' ? 4000 : mode === 'health' ? 3000 : mode === 'freestyle' ? 4000 : 1500,
        temperature: mode === 'technical' ? 0.4 : mode === 'health' ? 0.4 : mode === 'freestyle' ? 0.7 : 0.85,
      }
    });

    // Build conversation history for Gemini
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Start chat with history
    const chat = model.startChat({ history });
    
    // Send the current message
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error('No response from Gemini API');
    }

    return this.postProcessResponse(responseText, mode);
  }

  private async generateMistralResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 8);

    // In freestyle mode, enhance the prompt for code generation with language detection
    const enhancedMessage = mode === 'freestyle'
      ? this.getEnhancedFreestyleMessage(userMessage)
      : userMessage;

    // Build conversation context for Mistral
    const messages = [
      { role: 'system', content: systemPrompt + greetingInstruction }
    ];

    // Add recent conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: enhancedMessage });

    // Use appropriate Mistral model based on mode
    const modelSelection = mode === 'health'
      ? 'open-mistral-nemo' // Use Mistral Nemo for health mode (similar to CWC-Mistral-Nemo)
      : 'mistral-large-latest'; // Use latest Mistral for other modes

    const chatResponse = await mistral.chat.complete({
      model: modelSelection,
      messages: messages as any,
      maxTokens: mode === 'freestyle' ? 6000 : mode === 'technical' || mode === 'health' ? 4000 : 1200,
      temperature: mode === 'health' ? 0.4 : mode === 'freestyle' ? 0.7 : mode === 'technical' ? 0.4 : 0.85,
      topP: 0.95,
    });

    const response = chatResponse.choices?.[0]?.message?.content;

    if (!response) {
      throw new Error('No response from Mistral API');
    }

    // Handle both string and array responses from Mistral
    const responseText = typeof response === 'string' ? response : response.map((chunk: any) => chunk.text).join('');

    return this.postProcessResponse(responseText, mode);
  }

  private async generateReplitOptimizedResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 6);

    // In freestyle mode, enhance the prompt for code generation with language detection
    const enhancedMessage = mode === 'freestyle'
      ? this.getEnhancedFreestyleMessage(userMessage)
      : userMessage;

    // Enhanced context building for Replit environment
    let prompt = `${systemPrompt}${greetingInstruction}\n\nReplit Environment Context:
- Terminal Interface: ARCHIMEDES v7 cyberpunk-styled AI terminal
- User Environment: Replit development workspace
- Deployment Target: Replit's cloud infrastructure
- Database: Replit-managed PostgreSQL available
- Authentication: Replit Auth integrated

Conversation Context:\n`;

    // Add optimized conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `ARCHIMEDES: ${msg.content}\n`;
      }
    }

    prompt += `User: ${enhancedMessage}\nARCHIMEDES:`;

    // Reduced timeout for faster response (6 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 6000);
    });

    // Use optimized models for Replit
    const fetchPromise = this.tryReplitOptimizedModels(prompt, mode);

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (typeof result === 'string' && result.trim()) {
      return this.postProcessResponse(result.trim(), mode);
    }

    throw new Error('No valid response from Replit-optimized AI pipeline');
  }

  private async tryReplitOptimizedModels(prompt: string, mode: 'natural' | 'technical' | 'freestyle' | 'health'): Promise<string> {
    // Primary model: Fast and efficient for Replit
    const models = [
      REPLIT_AI_CONFIG.primaryModel,
      ...REPLIT_AI_CONFIG.fallbackModels
    ];

    for (const model of models) {
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ARCHIMEDES-v7-Replit-Terminal/1.0'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: REPLIT_AI_CONFIG.maxTokens[(mode === 'freestyle' || mode === 'health') ? 'technical' : mode],
              temperature: REPLIT_AI_CONFIG.temperature[(mode === 'freestyle' || mode === 'health') ? 'technical' : mode],
              return_full_text: false,
              do_sample: true,
              top_p: 0.9,
              repetition_penalty: 1.1
            }
          })
        });

        if (response.ok) {
          const result = await response.json();

          if (Array.isArray(result) && result[0]?.generated_text) {
            return result[0].generated_text;
          }

          if (typeof result === 'object' && result.generated_text) {
            return result.generated_text;
          }
        }
      } catch (error) {
        console.log(`Replit-optimized model ${model} failed, trying next...`);
        continue;
      }
    }

    throw new Error('All Replit-optimized models failed');
  }

  private postProcessResponse(response: string, mode: 'natural' | 'technical' | 'freestyle' | 'health'): string {
    // Clean up the response
    let cleaned = response.trim();

    // Remove common artifacts
    cleaned = cleaned.replace(/^(ARCHIMEDES:|Assistant:|AI:)\s*/i, '');
    cleaned = cleaned.replace(/\n\s*Human:\s*.*$/, ''); // Remove any trailing human input

    // Add Replit-specific context hints for natural mode
    if (mode === 'natural') {
      // Add subtle Replit environment awareness
      if (cleaned.toLowerCase().includes('deploy') && !cleaned.toLowerCase().includes('replit')) {
        cleaned += ' (You can deploy this directly on Replit with one click!)';
      }
    }

    return cleaned;
  }

  private async generateOpenAIResponse(
    userMessage: string,
    mode: 'natural' | 'technical' | 'freestyle' | 'health',
    conversationHistory: Message[] = [],
    language: string = 'english',
    isNewSession: boolean = false
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode, userMessage);
    const greetingInstruction = this.buildSessionGreeting(isNewSession);
    const recentHistory = this.buildConversationHistory(conversationHistory, 10);

    // In freestyle mode, enhance the prompt for code generation with language detection
    const enhancedMessage = mode === 'freestyle'
      ? this.getEnhancedFreestyleMessage(userMessage)
      : userMessage;

    // Build conversation context
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + greetingInstruction }
    ];

    // Add recent conversation history
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: enhancedMessage });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: mode === 'technical' || mode === 'freestyle' ? 4000 : 2000, // Adjusted for freestyle
      temperature: mode === 'technical' || mode === 'freestyle' ? 0.3 : 0.7, // Adjusted for freestyle
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';
  }

  private getEnhancedFallbackResponse(input: string, mode: 'natural' | 'technical' | 'freestyle' | 'health'): string {
    if (mode === 'natural') {
      return this.generateEnhancedNaturalFallback(input);
    } else { // Technical, Freestyle, or Health mode
      return this.generateEnhancedTechnicalFallback(input);
    }
  }

  private generateEnhancedNaturalFallback(input: string): string {
    // Return a more context-aware fallback that doesn't mention the AI platform
    return `⚠️ ARCHIMEDES AI Status: Backend API Rate Limits Reached

Looks like I've hit some API quotas, choom. Here's what's happening:
• Mistral AI: Service capacity exceeded
• Google Gemini: Free tier quota exhausted
• This usually resets within a few minutes

Meanwhile, try these commands:
• 'help' - View available terminal commands
• 'weather' - Get weather without AI processing
• 'books search <query>' - Search Project Gutenberg
• 'stock quote <symbol>' - Get stock quotes
• 'scholar search <topic>' - Search academic papers

The terminal features still work - only the AI chat responses are temporarily limited. Query again in a few minutes and I should be back online!`;
  }

  private generateEnhancedTechnicalFallback(input: string): string {
    return `ARCHIMEDES Protocol v7 - System Error

ERROR: AI processing backend unavailable or timed out
Query Topic: ${input}

Diagnostic Information:
- All primary AI models failed to respond
- Possible causes: API rate limits, network timeout, service outage
- Recommended action: Retry query or check server logs

This is a fallback response. The actual AI analysis could not be completed.`;
  }

  /**
   * Generate code completions using Mistral AI for monacopilot
   * Supports multiple programming languages with proper cleanup
   */
  async generateCodeCompletion(
    code: string,
    language: string = 'python',
    filename?: string
  ): Promise<string> {
    try {
      // Language-specific style guidelines
      const styleGuides: Record<string, string> = {
        python: 'follow PEP 8 style guidelines',
        javascript: 'use modern ES6+ syntax and conventions',
        typescript: 'use proper TypeScript types and interfaces',
        java: 'follow Java naming conventions (camelCase for methods, PascalCase for classes)',
        cpp: 'follow C++ best practices with proper memory management',
        c: 'follow C99 standard conventions',
        go: 'follow Go formatting conventions (gofmt style)',
        rust: 'follow Rust idioms and ownership patterns',
        ruby: 'follow Ruby style guide conventions',
        php: 'follow PSR-12 coding standards',
        bash: 'follow shell scripting best practices'
      };

      const styleGuide = styleGuides[language.toLowerCase()] || 'follow best practices';

      const systemPrompt = `You are an expert ${language} code completion assistant. Your task is to provide concise, accurate code completions.

CRITICAL RULES:
1. Only provide the completion text - NO explanations, NO markdown, NO code blocks
2. Complete the code naturally from where it ends
3. Keep completions focused and relevant
4. Provide syntactically correct code
5. ${styleGuide}
6. Return ONLY the code that should be added, nothing else`;

      const userPrompt = `Complete this ${language} code${filename ? ` from ${filename}` : ''}:

${code}`;

      const chatResponse = await mistral.chat.complete({
        model: 'codestral-latest', // Mistral's specialized code model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        maxTokens: 500, // Keep completions concise
        temperature: 0.2, // Low temperature for more predictable completions
        topP: 0.95,
      });

      const completion = chatResponse.choices?.[0]?.message?.content;

      if (!completion) {
        return '';
      }

      // Clean up the response - remove any markdown code blocks
      let cleanedCompletion = typeof completion === 'string' ? completion : completion.map((chunk: any) => chunk.text).join('');

      // Remove markdown code blocks for all supported languages
      const codeBlockPatterns = [
        /```(?:python|py|javascript|js|typescript|ts|java|cpp|c|go|rust|ruby|php|bash|sql|r|perl|html|css)?\n?/g,
        /```\n?/g
      ];

      codeBlockPatterns.forEach(pattern => {
        cleanedCompletion = cleanedCompletion.replace(pattern, '');
      });

      // Trim excessive whitespace
      cleanedCompletion = cleanedCompletion.trim();

      return cleanedCompletion;
    } catch (error) {
      console.error('Code completion error:', error);
      return ''; // Return empty string on error - graceful degradation
    }
  }
}

export const llmService = LLMService.getInstance();