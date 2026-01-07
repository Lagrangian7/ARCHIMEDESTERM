import type { Express } from "express";
import express from "express";
import path from "path";
import { createServer, type Server } from "http";
import https from "https";
import { promisify } from "util";
import { exec } from "child_process";
import { storage } from "./storage";
import { messageSchema, type Message, insertUserPreferencesSchema, insertDocumentSchema, type Document } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { weatherService } from "./weather-service";
import { knowledgeService } from "./knowledge-service";
import { gutendxService } from "./gutendx-service";
import { marketstackService } from "./marketstack-service";
import { scholarService } from "./scholar-service";
import multer from "multer";
import { z } from "zod";
import compression from "compression";
import { spawn } from "child_process";
import dns from 'dns/promises';
import { URL } from 'url';
import net from 'net';
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';

// Rate limiter for code execution endpoints (prevents abuse)
// Limits: 10 requests per minute per IP
const executeRateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkExecuteRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = executeRateLimiter.get(ip);
  
  // Clean up expired entries periodically (every 100th check)
  if (Math.random() < 0.01) {
    for (const [key, val] of Array.from(executeRateLimiter.entries())) {
      if (now >= val.resetAt) executeRateLimiter.delete(key);
    }
  }
  
  if (!entry || now >= entry.resetAt) {
    // New window - reset counter
    executeRateLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Increment counter
  entry.count++;
  return { allowed: true };
}

// Middleware to apply rate limiting to execute endpoints
function executeRateLimitMiddleware(req: any, res: any, next: any) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const { allowed, retryAfter } = checkExecuteRateLimit(ip);
  
  if (!allowed) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    });
  }
  
  next();
}

/**
 * Post-process AI-generated code to clean up common issues
 * - Removes duplicate code block markers
 * - Fixes common syntax artifacts
 * - Normalizes whitespace
 */
function cleanupGeneratedCode(response: string): string {
  let cleaned = response;
  
  // Fix duplicate opening code blocks (e.g., ```python```python)
  cleaned = cleaned.replace(/```(\w+)```\1/g, '```$1');
  
  // Fix code blocks with language repeated inside (```python\npython\n)
  cleaned = cleaned.replace(/```(\w+)\n\1\n/g, '```$1\n');
  
  // Remove trailing whitespace on lines inside code blocks
  cleaned = cleaned.replace(/^(.*)[ \t]+$/gm, '$1');
  
  // Ensure code blocks have proper newlines before content
  cleaned = cleaned.replace(/```(\w+)([^\n])/g, '```$1\n$2');
  
  // Fix missing newline before closing code block
  cleaned = cleaned.replace(/([^\n])```/g, '$1\n```');
  
  // Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  // Remove HTML entities that sometimes appear in code
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  
  return cleaned;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Initialize Git repository on startup (for both dev and production)
  const initializeGit = async () => {
    try {
      const execPromise = promisify(exec);

      // Check if .git directory exists
      const { stdout: gitCheck } = await execPromise('[ -d .git ] && echo "exists" || echo "missing"', { timeout: 2000 });

      if (gitCheck.trim() === 'missing') {
        console.log('🔧 Git not initialized, initializing now...');
        await execPromise('git init', { timeout: 5000 });
        await execPromise('git config user.name "Archimedes Terminal"', { timeout: 2000 });
        await execPromise('git config user.email "terminal@archimedes.local"', { timeout: 2000 });
      }

      // Always check if we have commits, regardless of whether .git existed
      let hasCommits = false;
      try {
        await execPromise('git rev-parse HEAD', { timeout: 2000 });
        hasCommits = true;
        console.log('✅ Git repository has commits');
      } catch {
        console.log('🔧 No commits found, creating initial commit...');
      }

      // Create initial commit if needed
      if (!hasCommits) {
        try {
          // Add all files (including hidden ones, excluding .git itself)
          await execPromise('git add -A', { timeout: 10000 });

          // Always create a commit with --allow-empty to ensure we have at least one
          await execPromise('git commit -m "Initial commit" --allow-empty --no-verify', { timeout: 20000 });
          console.log('✅ Initial commit created successfully');

          // Verify the commit was created
          await execPromise('git rev-parse HEAD', { timeout: 2000 });
          console.log('✅ Git repository fully initialized with commits');
        } catch (commitError: any) {
          console.error('⚠️ Failed to create initial commit:', commitError.message);
          console.error('⚠️ Error details:', commitError.stderr || commitError.stdout || 'No additional details');
        }
      }
    } catch (error: any) {
      console.error('⚠️ Git initialization failed:', error.message);
      console.error('⚠️ Error details:', error.stderr || error.stdout || 'No additional details');
    }
  };

  // Run Git initialization in the background (non-blocking)
  // Skip in production deployments where .git doesn't exist and can't be created
  if (process.env.REPLIT_DEPLOYMENT !== '1') {
    // Fire and forget - don't block server startup
    initializeGit().catch(err => console.error('Git init background error:', err));
  } else {
    console.log('⏭️ Skipping git initialization in deployment environment');
  }

  // Health check endpoint - MUST be first, before any middleware
  // This allows deployment health checks to succeed quickly (v2.0)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API status endpoint - shows which AI services are configured (no sensitive values)
  app.get('/api/status', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      isDeployment: process.env.REPLIT_DEPLOYMENT === '1',
      services: {
        groq: !!process.env.GROQ_API_KEY,
        gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        openai: !!process.env.OPENAI_API_KEY,
        mistral: !!process.env.MISTRAL_API_KEY,
        huggingface: !!process.env.HUGGINGFACE_API_KEY,
        database: !!process.env.DATABASE_URL,
      }
    });
  });

  // Git initialization endpoint - ensures .git exists
  app.post('/api/git/init', async (req, res) => {
    try {
      const execPromise = promisify(exec);

      // Check if .git directory exists
      const { stdout: gitCheck } = await execPromise('[ -d .git ] && echo "exists" || echo "missing"', { timeout: 1000 });

      if (gitCheck.trim() === 'missing') {
        // Initialize git repository
        await execPromise('git init', { timeout: 5000 });
        await execPromise('git config user.name "Archimedes Terminal"', { timeout: 1000 });
        await execPromise('git config user.email "terminal@archimedes.local"', { timeout: 1000 });

        // Create initial commit if there are no commits
        try {
          await execPromise('git add .', { timeout: 5000 });
          await execPromise('git commit -m "Initial commit"', { timeout: 10000 });
        } catch (commitError) {
          // Ignore commit errors (might already have commits or no changes)
        }

        res.json({ initialized: true, message: 'Git repository initialized' });
      } else {
        res.json({ initialized: false, message: 'Git repository already exists' });
      }
    } catch (error: any) {
      console.error('Git init error:', error);
      res.status(500).json({ error: 'Failed to initialize git repository', details: error.message });
    }
  });

  // Git log endpoint for Code Playground git panel
  app.get('/api/git/log', async (req, res) => {
    try {
      const execPromise = promisify(exec);

      // Check if .git exists first
      const { stdout: gitCheck } = await execPromise('[ -d .git ] && echo "exists" || echo "missing"', { timeout: 2000 });

      if (gitCheck.trim() === 'missing') {
        console.log('📊 Git log: .git directory not found');
        return res.json({ commits: [], needsInit: true });
      }

      // Check if repository has commits
      try {
        await execPromise('git rev-parse HEAD', { timeout: 2000 });
      } catch {
        console.log('📊 Git log: repository has no commits yet');
        return res.json({ commits: [], needsInit: false, message: 'Repository initialized but no commits yet' });
      }

      const { stdout } = await execPromise(
        'git log --format="%H|%s|%an|%ar" -n 20',
        { timeout: 5000 }
      );

      const commits = stdout.trim().split('\n')
        .filter(line => line.trim() && line.includes('|'))
        .map(line => {
          const parts = line.split('|');
          return {
            hash: parts[0] || '',
            message: parts[1] || '',
            author: parts[2] || '',
            date: parts[3] || ''
          };
        });

      console.log(`📊 Git log: found ${commits.length} commits`);
      res.json({ commits, needsInit: false });
    } catch (error: any) {
      console.error('📊 Git log error:', error.message);
      res.json({ commits: [], needsInit: false, error: error.message });
    }
  });

  // Git status endpoint for file status
  app.get('/api/git/status', async (req, res) => {
    try {
      const execPromise = promisify(exec);
      const { stdout } = await execPromise(
        'git status --porcelain',
        { timeout: 5000 }
      );

      const files = stdout.trim().split('\n')
        .filter(line => line.trim())
        .map(line => {
          const staged = line[0];   // Index (staged) status
          const unstaged = line[1]; // Working tree (unstaged) status
          const file = line.slice(3);

          // Determine primary status and whether staged/unstaged
          let statusLabel = 'modified';
          let isStaged = false;
          let isUnstaged = false;

          if (staged === '?' && unstaged === '?') {
            statusLabel = 'untracked';
          } else {
            // Check staged status
            if (staged === 'A') { statusLabel = 'added'; isStaged = true; }
            else if (staged === 'M') { statusLabel = 'modified'; isStaged = true; }
            else if (staged === 'D') { statusLabel = 'deleted'; isStaged = true; }
            else if (staged === 'R') { statusLabel = 'renamed'; isStaged = true; }

            // Check unstaged status (working tree)
            if (unstaged === 'M') { isUnstaged = true; if (!isStaged) statusLabel = 'modified'; }
            else if (unstaged === 'D') { isUnstaged = true; if (!isStaged) statusLabel = 'deleted'; }
          }

          return { file, status: statusLabel, raw: line.slice(0, 2), staged: isStaged, unstaged: isUnstaged };
        });

      res.json({ files });
    } catch (error: any) {
      res.json({ files: [] });
    }
  });

  // Git diff endpoint - shows full unified diff of uncommitted changes
  app.get('/api/git/diff', async (req, res) => {
    try {
      const execPromise = promisify(exec);
      // Get full unified diff, limit output to prevent huge responses
      const { stdout } = await execPromise(
        'git diff HEAD 2>/dev/null | head -500 || git diff | head -500',
        { timeout: 10000, maxBuffer: 1024 * 1024 }
      );

      res.json({ diff: stdout.trim() });
    } catch (error: any) {
      res.json({ diff: '' });
    }
  });

  // Git commit details endpoint - shows full diff for a specific commit
  app.get('/api/git/commit/:hash', async (req, res) => {
    try {
      const { hash } = req.params;
      const execPromise = promisify(exec);

      // Get commit details and diff
      const { stdout } = await execPromise(
        `git show ${hash} --format=fuller | head -1000`,
        { timeout: 10000, maxBuffer: 1024 * 1024 }
      );

      res.json({ diff: stdout.trim() });
    } catch (error: any) {
      res.json({ diff: '' });
    }
  });

  // Enable gzip compression
  app.use(compression());

  // Serve attached assets (for soundtrack and other user files)
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  // Serve coi-serviceworker.js for cross-origin isolation (WebContainer support)
  app.get('/coi-serviceworker.js', (req, res) => {
    const coiPath = path.join(process.cwd(), 'client', 'public', 'coi-serviceworker.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(coiPath);
  });

  // AI Project Builder - Agent & Architect collaboration
  app.post('/api/project-builder', async (req, res) => {
    try {
      const { spec, language } = req.body;

      if (!spec?.trim()) {
        return res.status(400).json({ error: 'Project specification is required' });
      }

      const agentMessages: Array<{ role: 'agent' | 'architect', content: string }> = [];

      // Agent phase: Plan the architecture
      agentMessages.push({
        role: 'agent',
        content: 'Analyzing project requirements and planning architecture...'
      });

      const agentPrompt = `You are the AGENT. Analyze this project spec and create a detailed file structure plan:
"${spec}"

Target language: ${language || 'python'}

Respond with a JSON array of files needed. Each file should have:
{
  "name": "filename.ext",
  "language": "languageId",
  "purpose": "what this file does",
  "dependencies": ["file1.ext", "file2.ext"]
}

Plan a complete, production-ready project structure. Be thorough.`;

      const agentResponse = await llmService.generateResponse(
        agentPrompt,
        'freestyle',
        [],
        undefined,
        'english',
        false
      );

      let filePlan: any[] = [];
      try {
        const jsonMatch = agentResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          filePlan = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse agent response:', e);
      }

      if (filePlan.length === 0) {
        throw new Error('Agent failed to create file plan');
      }

      agentMessages.push({
        role: 'agent',
        content: `Planned ${filePlan.length} files: ${filePlan.map(f => f.name).join(', ')}`
      });

      // Architect phase: Implement each file
      const files = [];
      for (const fileSpec of filePlan) {
        agentMessages.push({
          role: 'architect',
          content: `Implementing ${fileSpec.name}...`
        });

        const architectPrompt = `You are the ARCHITECT. Implement this file based on the project spec:

Project: "${spec}"
File: ${fileSpec.name}
Purpose: ${fileSpec.purpose}
Language: ${fileSpec.language}

Write COMPLETE, PRODUCTION-READY code. Include:
- Proper imports/dependencies
- Error handling
- Comments explaining key sections
- Best practices for ${fileSpec.language}

ONLY output the code, no explanations.`;

        const code = await llmService.generateResponse(
          architectPrompt,
          'freestyle',
          [],
          undefined,
          'english',
          false
        );

        // Extract code from markdown blocks if present
        let cleanCode = code;
        const codeBlockMatch = code.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1].trim();
        }

        files.push({
          name: fileSpec.name,
          language: fileSpec.language,
          content: cleanCode
        });

        agentMessages.push({
          role: 'architect',
          content: `✓ ${fileSpec.name} implemented (${cleanCode.split('\n').length} lines)`
        });
      }

      agentMessages.push({
        role: 'agent',
        content: 'Project complete! All ${files.length} files generated and ready.'
      });

      res.json({
        success: true,
        files,
        agentMessages
      });

    } catch (error) {
      console.error('Project builder error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Project generation failed'
      });
    }
  });

  // Collaborative AI Code Review - Uses Groq (free Llama AI)
  app.post('/api/code/review', async (req, res) => {
    try {
      const { code, language = 'python', projectName, filePath, relatedFiles } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }

      const result = await llmService.collaborativeCodeReview(
        code,
        language,
        projectName,
        filePath,
        relatedFiles
      );

      res.json(result);
    } catch (error) {
      console.error('Code review error:', error);
      res.status(500).json({
        error: 'Failed to perform code review',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute Python code with GUI support
  app.post('/api/execute/python', executeRateLimitMiddleware, async (req, res) => {
    try {
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Code is required and must be a string'
        });
      }

      // Check if code uses GUI libraries
      const hasGuiLibraries = /import\s+(tkinter|matplotlib|pygame|turtle|PyQt|PySide)/i.test(code);

      // Wrap GUI code to capture output as HTML/image
      const wrappedCode = hasGuiLibraries ? `
import sys
import io
import base64

# Capture GUI output
_gui_output = None

${code}

# For matplotlib, capture plot as base64 image
try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
        plt.close('all')
except ImportError:
    pass
except Exception as e:
    print(f'GUI rendering error: {e}', file=sys.stderr)

# For tkinter, we can't render in headless but we'll note it
try:
    import tkinter as tk
    if tk._default_root:
        print('__GUI_OUTPUT__:<div style="padding:20px; background:#f0f0f0; border-radius:8px;"><strong>🖼️ Tkinter GUI Application</strong><br/>GUI window was created but cannot be displayed in headless mode.<br/>Run this code locally to see the interface.</div>')
except:
    pass
` : code;

      const startTime = Date.now();
      const timeout = 120000; // 2 minute timeout for large programs

      const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', wrappedCode]);
        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          pythonProcess.kill();
          reject(new Error('Execution timeout (2 minutes) - Code took too long to execute'));
        }, timeout);

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          clearTimeout(timer);
          if (!killed) {
            resolve({ stdout, stderr, code: code || 0 });
          }
        });

        pythonProcess.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // Extract GUI output if present
      let guiOutput = null;
      let textOutput = result.stdout;
      const guiMatch = result.stdout.match(/__GUI_OUTPUT__:(.*)/);
      if (guiMatch) {
        guiOutput = guiMatch[1];
        textOutput = result.stdout.replace(/__GUI_OUTPUT__:.*/, '').trim();
      }

      if (result.code !== 0) {
        return res.json({
          success: false,
          error: result.stderr,
          output: textOutput,
          guiOutput,
          executionTime
        });
      }

      res.json({
        success: true,
        output: textOutput,
        guiOutput,
        executionTime
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      });
    }
  });

  // Multi-language code execution endpoints
  app.post('/api/execute/javascript', executeRateLimitMiddleware, isAuthenticated, async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(`node -e ${JSON.stringify(code)}`, {
        timeout: 60000,
        maxBuffer: 1024 * 1024
      });
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      res.json({
        success: !stderr,
        output: stdout,
        error: stderr,
        executionTime
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message || 'JavaScript execution failed',
        executionTime: 0
      });
    }
  });

  app.post('/api/execute/typescript', executeRateLimitMiddleware, isAuthenticated, async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    let tmpFile: string | null = null;
    try {
      const fs = await import('fs/promises');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const path = await import('path');

      tmpFile = path.join('/tmp', `code_${Date.now()}.ts`);
      await fs.writeFile(tmpFile, code);

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(`npx tsx ${tmpFile}`, {
        timeout: 60000,
        maxBuffer: 1024 * 1024
      });
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      res.json({
        success: !stderr,
        output: stdout,
        error: stderr,
        executionTime
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message || 'TypeScript execution failed',
        executionTime: 0
      });
    } finally {
      if (tmpFile) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(tmpFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  });

  app.post('/api/execute/bash', executeRateLimitMiddleware, isAuthenticated, async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(code, {
        shell: '/bin/bash',
        timeout: 60000,
        maxBuffer: 1024 * 1024
      });
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      res.json({
        success: !stderr,
        output: stdout,
        error: stderr,
        executionTime
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message || 'Bash execution failed',
        executionTime: 0
      });
    }
  });

  app.post('/api/execute/cpp', executeRateLimitMiddleware, isAuthenticated, async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    let tmpFile: string | null = null;
    let tmpExec: string | null = null;
    try {
      const fs = await import('fs/promises');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const path = await import('path');

      tmpFile = path.join('/tmp', `code_${Date.now()}.cpp`);
      tmpExec = path.join('/tmp', `exec_${Date.now()}`);
      await fs.writeFile(tmpFile, code);

      // Compile
      await execAsync(`g++ ${tmpFile} -o ${tmpExec}`, { timeout: 60000 });

      // Execute
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(tmpExec, {
        timeout: 120000,
        maxBuffer: 1024 * 1024
      });
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      res.json({
        success: !stderr,
        output: stdout,
        error: stderr,
        executionTime
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message || 'C++ execution failed',
        executionTime: 0
      });
    } finally {
      try {
        const fs = await import('fs/promises');
        if (tmpFile) await fs.unlink(tmpFile);
        if (tmpExec) await fs.unlink(tmpExec);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // Unified code execution endpoint - uses spawn with array args for security
  app.post('/api/execute', executeRateLimitMiddleware, async (req, res) => {
    const { code, language, stdin } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    // Limit code size for safety
    if (code.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Code too large (max 50KB)'
      });
    }

    const lang = (language || 'python').toLowerCase();

    // Helper to run a process with timeout using spawn (safer than exec)
    const runProcess = (cmd: string, args: string[], timeout: number = 60000, stdinData?: string): Promise<{ stdout: string; stderr: string; code: number }> => {
      return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { timeout, stdio: stdinData ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          proc.kill('SIGKILL');
          reject(new Error(`Execution timeout (${timeout / 1000} seconds)`));
        }, timeout);

        // Write stdin if provided
        if (stdinData && proc.stdin) {
          proc.stdin.write(stdinData);
          proc.stdin.end();
        }

        proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
        proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

        proc.on('close', (exitCode: number) => {
          clearTimeout(timer);
          if (!killed) resolve({ stdout, stderr, code: exitCode || 0 });
        });

        proc.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    };

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const crypto = await import('crypto');

      // Generate random filename to prevent predictable paths
      const randomId = crypto.randomBytes(8).toString('hex');

      let output = '';
      let error = '';
      let executionTime = '0';
      let guiOutput = null;
      const startTime = Date.now();

      switch (lang) {
        case 'python': {
          // Check for different GUI libraries
          const hasMatplotlib = /import\s+matplotlib|from\s+matplotlib/i.test(code);
          const hasTkinter = /import\s+tkinter|from\s+tkinter/i.test(code);
          const hasPygame = /import\s+pygame/i.test(code);
          const hasTurtle = /import\s+turtle|from\s+turtle/i.test(code);
          const hasGuiLibraries = hasMatplotlib || hasTkinter || hasPygame || hasTurtle;

          let wrappedCode = code;

          if (hasGuiLibraries) {
            // Create a comprehensive GUI capture wrapper
            wrappedCode = `
import sys
import io
import base64
import os
import time

# Set up virtual display for headless rendering
try:
    from pyvirtualdisplay import Display
    display = Display(visible=False, size=(800, 600))
    display.start()
    _virtual_display_started = True
except Exception as e:
    _virtual_display_started = False
    print(f"Virtual display setup: {e}", file=sys.stderr)

_gui_output_generated = False

${hasTkinter ? `
# Tkinter capture wrapper - improved to allow proper rendering
_tk_root = None
_tk_capture_done = False

def _do_tkinter_capture():
    global _gui_output_generated, _tk_root, _tk_capture_done
    if _tk_capture_done:
        return
    _tk_capture_done = True
    try:
        if _tk_root and _tk_root.winfo_exists():
            _tk_root.update_idletasks()
            _tk_root.update()

            # Use PIL to capture the full screen and crop to window
            from PIL import Image
            import subprocess

            # Get window geometry
            x = _tk_root.winfo_rootx()
            y = _tk_root.winfo_rooty()
            w = _tk_root.winfo_width()
            h = _tk_root.winfo_height()

            # Try using scrot for screenshot
            try:
                screenshot_file = f'/tmp/tk_capture_{os.getpid()}.png'
                subprocess.run(['scrot', '-o', screenshot_file], timeout=5, check=True)
                img = Image.open(screenshot_file)
                # Crop to window area
                img = img.crop((x, y, x+w, y+h))
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
                _gui_output_generated = True
                os.remove(screenshot_file)
            except Exception as e:
                print(f"Screenshot capture failed: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Tkinter capture error: {e}", file=sys.stderr)
    finally:
        if _tk_root:
            try:
                _tk_root.destroy()
            except:
                pass

# Patch Tk class to intercept mainloop
import tkinter as tk
_original_Tk = tk.Tk

class _PatchedTk(_original_Tk):
    def __init__(self, *args, **kwargs):
        global _tk_root
        super().__init__(*args, **kwargs)
        _tk_root = self

    def mainloop(self, n=0):
        # Schedule capture after allowing window to render
        self.after(500, _do_tkinter_capture)
        # Run event loop briefly to process events
        end_time = time.time() + 1.0  # Max 1 second
        while time.time() < end_time:
            try:
                self.update_idletasks()
                self.update()
            except:
                break
            time.sleep(0.05)
        _do_tkinter_capture()

tk.Tk = _PatchedTk
` : ''}

${hasPygame ? `
# Pygame capture wrapper - capture on first flip after initial render
import pygame as _pg_module

_original_pygame_display_flip = _pg_module.display.flip
_original_pygame_display_update = _pg_module.display.update
_pygame_frame_count = 0
_pygame_capture_scheduled = False

def _capture_pygame_surface():
    global _gui_output_generated
    if _gui_output_generated:
        return
    try:
        surface = _pg_module.display.get_surface()
        if surface:
            # Save surface to bytes
            buf = io.BytesIO()
            _pg_module.image.save(surface, buf, 'PNG')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
            _gui_output_generated = True
    except Exception as e:
        print(f"Pygame capture error: {e}", file=sys.stderr)

def _patched_flip():
    global _pygame_frame_count
    _original_pygame_display_flip()
    _pygame_frame_count += 1
    # Capture after first flip (user has drawn something)
    if _pygame_frame_count == 1:
        _capture_pygame_surface()

def _patched_update(*args):
    global _pygame_frame_count
    _original_pygame_display_update(*args)
    _pygame_frame_count += 1
    # Capture after first update
    if _pygame_frame_count == 1:
        _capture_pygame_surface()

_pg_module.display.flip = _patched_flip
_pg_module.display.update = _patched_update
` : ''}

${hasTurtle ? `
# Turtle graphics capture - uses PostScript with Ghostscript conversion
import turtle as _turtle_module

def _capture_turtle():
    global _gui_output_generated
    if _gui_output_generated:
        return
    try:
        import subprocess
        from PIL import Image

        screen = _turtle_module.getscreen()
        screen.update()
        time.sleep(0.2)

        canvas = screen.getcanvas()
        eps_file = f'/tmp/turtle_{os.getpid()}.eps'
        png_file = f'/tmp/turtle_{os.getpid()}.png'

        # Save as PostScript
        canvas.postscript(file=eps_file, colormode='color')

        # Convert EPS to PNG using Ghostscript
        try:
            subprocess.run([
                'gs', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop',
                '-sDEVICE=png16m', '-r150',
                f'-sOutputFile={png_file}', eps_file
            ], timeout=10, check=True, capture_output=True)

            img = Image.open(png_file)
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
            _gui_output_generated = True
        except Exception as gs_err:
            # Fallback: try using scrot for screen capture
            try:
                screenshot_file = f'/tmp/turtle_scrot_{os.getpid()}.png'
                subprocess.run(['scrot', '-o', screenshot_file], timeout=5, check=True)
                img = Image.open(screenshot_file)
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                buf.seek(0)
                img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
                _gui_output_generated = True
                os.remove(screenshot_file)
            except Exception as scrot_err:
                print(f"Turtle capture fallback failed: {scrot_err}", file=sys.stderr)
        finally:
            # Cleanup temp files
            for f in [eps_file, png_file]:
                try:
                    os.remove(f)
                except:
                    pass
    except Exception as e:
        print(f"Turtle capture error: {e}", file=sys.stderr)

def _patched_done():
    _capture_turtle()
    # Exit after capture

def _patched_mainloop():
    _capture_turtle()

_turtle_module.done = _patched_done
_turtle_module.mainloop = _patched_mainloop
_turtle_module.exitonclick = _patched_done
` : ''}

# ===== USER CODE START =====
${code}
# ===== USER CODE END =====

${hasMatplotlib ? `
# Matplotlib capture (static plots and animations)
try:
    import matplotlib.pyplot as plt
    from matplotlib import animation

    if plt.get_fignums() and not _gui_output_generated:
        # Check if animation exists
        has_animation = False
        try:
            # Look for FuncAnimation in globals
            for name in dir():
                obj = eval(name)
                if isinstance(obj, animation.FuncAnimation):
                    has_animation = True
                    # Save animation as GIF
                    gif_path = f'/tmp/animation_{os.getpid()}.gif'
                    obj.save(gif_path, writer='pillow', fps=30, dpi=80)
                    with open(gif_path, 'rb') as f:
                        gif_base64 = base64.b64encode(f.read()).decode('utf-8')
                    print(f'__GUI_OUTPUT__:<img src="data:image/gif;base64,{gif_base64}" style="max-width:100%; height:auto;" />')
                    _gui_output_generated = True
                    os.remove(gif_path)
                    break
        except:
            pass

        # If no animation, capture static plot
        if not _gui_output_generated:
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
            _gui_output_generated = True

        plt.close('all')
except ImportError:
    pass
except Exception as e:
    print(f'Matplotlib capture error: {e}', file=sys.stderr)
` : ''}

${hasTurtle ? `
# Final turtle capture if not already done
if not _gui_output_generated:
    try:
        _capture_turtle()
    except:
        pass
` : ''}

# Clean up virtual display
if _virtual_display_started:
    try:
        display.stop()
    except:
        pass
`;
          }

          const result = await runProcess('python3', ['-c', wrappedCode], 120000, stdin);

          // Extract GUI output if present (using [\s\S] instead of /s flag for compatibility)
          const guiMatch = result.stdout.match(/__GUI_OUTPUT__:([\s\S]*)/);
          if (guiMatch) {
            guiOutput = guiMatch[1];
            output = result.stdout.replace(/__GUI_OUTPUT__:.*/, '').trim();
          } else {
            output = result.stdout;
          }
          error = result.stderr;
          break;
        }

        case 'javascript':
        case 'js': {
          // Use spawn with -e flag (code passed as argument, not shell-interpolated)
          const result = await runProcess('node', ['-e', code], 60000, stdin);
          output = result.stdout;
          error = result.stderr;
          break;
        }

        case 'typescript':
        case 'ts': {
          const tmpFile = path.join('/tmp', `ts_${randomId}.ts`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            const result = await runProcess('npx', ['tsx', tmpFile], 60000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
          }
          break;
        }

        case 'bash':
        case 'shell':
        case 'sh': {
          // Write to temp file and execute (safer than passing code to bash -c)
          const tmpFile = path.join('/tmp', `sh_${randomId}.sh`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            const result = await runProcess('bash', [tmpFile], 60000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
          }
          break;
        }

        case 'cpp':
        case 'c++': {
          const tmpFile = path.join('/tmp', `cpp_${randomId}.cpp`);
          const tmpExec = path.join('/tmp', `exec_${randomId}`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            // Compile using spawn with array args
            await runProcess('g++', [tmpFile, '-o', tmpExec], 60000);
            // Execute
            const result = await runProcess(tmpExec, [], 120000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
            await fs.unlink(tmpExec).catch(() => {});
          }
          break;
        }

        case 'c': {
          const tmpFile = path.join('/tmp', `c_${randomId}.c`);
          const tmpExec = path.join('/tmp', `exec_${randomId}`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            // Compile using spawn with array args
            await runProcess('gcc', [tmpFile, '-o', tmpExec], 60000);
            // Execute
            const result = await runProcess(tmpExec, [], 120000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
            await fs.unlink(tmpExec).catch(() => {});
          }
          break;
        }

        case 'go':
        case 'golang': {
          const tmpFile = path.join('/tmp', `go_${randomId}.go`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            const result = await runProcess('go', ['run', tmpFile], 60000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
          }
          break;
        }

        case 'rust':
        case 'rs': {
          const tmpFile = path.join('/tmp', `rs_${randomId}.rs`);
          const tmpExec = path.join('/tmp', `exec_${randomId}`);
          await fs.writeFile(tmpFile, code, { mode: 0o600 });
          try {
            // Compile using spawn with array args
            await runProcess('rustc', [tmpFile, '-o', tmpExec], 60000);
            // Execute
            const result = await runProcess(tmpExec, [], 120000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
            await fs.unlink(tmpExec).catch(() => {});
          }
          break;
        }

        case 'ruby':
        case 'rb': {
          // Use spawn with -e flag
          const result = await runProcess('ruby', ['-e', code], 60000, stdin);
          output = result.stdout;
          error = result.stderr;
          break;
        }

        case 'php': {
          // Write to temp file (safer than -r with complex code)
          const tmpFile = path.join('/tmp', `php_${randomId}.php`);
          await fs.writeFile(tmpFile, `<?php\n${code}\n?>`, { mode: 0o600 });
          try {
            const result = await runProcess('php', [tmpFile], 60000, stdin);
            output = result.stdout;
            error = result.stderr;
          } finally {
            await fs.unlink(tmpFile).catch(() => {});
          }
          break;
        }

        case 'html': {
          // For HTML, provide safe inline preview using sandbox
          // Properly escape HTML for srcdoc attribute to prevent XSS
          const escapedForSrcdoc = code
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

          output = 'HTML Preview rendered below.\n\nTo run locally:\n1. Save as index.html\n2. Open in browser';
          // Use sandbox with restrictive permissions - only allow scripts, no same-origin access
          guiOutput = `<iframe srcdoc="${escapedForSrcdoc}" sandbox="allow-scripts" style="width:100%;height:400px;border:1px solid #00FF41;border-radius:4px;background:white;"></iframe>`;
          break;
        }

        default:
          return res.json({
            success: false,
            output: '',
            error: `Language '${lang}' is not supported for execution.\n\nSupported languages: python, javascript, typescript, bash, c, cpp, go, rust, ruby, php, html`,
            executionTime: '0'
          });
      }

      executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      res.json({
        success: !error || error.length === 0,
        output: output || '',
        error: error || '',
        executionTime,
        guiOutput
      });
    } catch (err: any) {
      res.json({
        success: false,
        output: '',
        error: err.message || 'Execution failed',
        executionTime: '0'
      });
    }
  });

  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup authentication BEFORE returning (must complete before Vite middleware)
  // This ensures auth routes are registered before the Vite catch-all route
  try {
    await setupAuth(app);
  } catch (error) {
    console.error('Failed to setup authentication:', error);
    console.warn('Server will continue running without authentication');
  }

  // Auth routes
  app.get('/api/auth/user', async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated?.() || !req.user?.claims?.sub) {
        return res.json({
          user: null,
          preferences: null
        });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const preferences = await storage.getUserPreferences(userId);

      res.json({
        user: user || null,
        preferences: preferences || null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      // Return null instead of error to prevent auth loops
      res.json({
        user: null,
        preferences: null
      });
    }
  });

  // Session keep-alive heartbeat endpoint
  // This endpoint triggers token refresh via isAuthenticated middleware
  app.get('/api/auth/heartbeat', isAuthenticated, async (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // User preferences routes
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);

      if (!preferences) {
        // Create default preferences if they don't exist
        const defaultPrefs = await storage.createUserPreferences({
          userId,
          defaultMode: "natural",
          voiceEnabled: false,
          selectedVoice: "default",
          voiceRate: "1",
          terminalTheme: "hacker",
          pythonIdeTheme: "terminal-green"
        });
        return res.json(defaultPrefs);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body
      const validationResult = insertUserPreferencesSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid preferences data",
          details: validationResult.error.errors
        });
      }

      const updatedPreferences = await storage.updateUserPreferences(userId, validationResult.data);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User conversation history routes
  app.get("/api/user/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get user conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chat endpoint (enhanced with user support)
  app.post("/api/chat", async (req, res) => {
    try {
      // Check authentication
      if (!req.isAuthenticated?.() || !req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = { id: req.user.claims.sub, name: req.user.claims.name || 'User', claims: req.user.claims };

      const { message, mode, language, programmingLanguage, editorContext } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validModes = ["natural", "technical", "freestyle", "health"];
      if (!mode || !validModes.includes(mode)) {
        return res.status(400).json({
          error: "Invalid mode. Valid modes are: natural, technical, freestyle, health"
        });
      }

      const currentSessionId = req.body.sessionId || randomUUID();

      // Add user message to conversation
      const userMessage: Message = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode || "natural",
        language: language || "english", // Store language preference
      };

      await storage.addMessageToConversation(currentSessionId, userMessage);

      // Get conversation history for context
      const conversation = await storage.getConversation(currentSessionId);
      const conversationHistory = Array.isArray(conversation?.messages) ? conversation.messages as Message[] : [];

      // Check if this is a new session (no history yet)
      const isNewSession = conversationHistory.length === 0;

      // Generate AI response using LLM with knowledge base integration
      let response: string;
      try {
        // Build enhanced message with programming language and editor context for freestyle mode
        let enhancedMessage = message;
        if (mode === 'freestyle') {
          const contextParts: string[] = [];
          
          // Add programming language context
          if (programmingLanguage) {
            contextParts.push(`[Programming Language: ${programmingLanguage}]`);
          }
          
          // Add editor context if provided (helps AI understand existing code)
          if (editorContext && typeof editorContext === 'string' && editorContext.trim()) {
            // TOKEN OPTIMIZATION: Reduced context limit from 2000 to 1000 chars
            const truncatedContext = editorContext.length > 1000 
              ? editorContext.substring(0, 1000) + '\n...[truncated]'
              : editorContext;
            contextParts.push(`[Current Editor Content - integrate with this code if relevant]:\n\`\`\`\n${truncatedContext}\n\`\`\``);
          }
          
          // Add project-wide context hints
          contextParts.push(`[Project Context]: This is part of the ARCHIMEDES AI Terminal - a full-stack web application with Python/Node.js backend and React frontend. The user's code should integrate seamlessly with existing patterns.`);
          
          if (contextParts.length > 0) {
            enhancedMessage = contextParts.join('\n') + '\n\n' + message;
          }
        }

        response = await llmService.generateResponse(
          enhancedMessage,
          mode || 'natural',
          conversationHistory,
          user.id,
          language || 'english', // Human language
          isNewSession // Pass new session flag
        );
      } catch (llmError) {
        console.error("LLM Service error:", llmError);
        // Log which services are available for debugging
        console.error("Available services:", {
          groq: !!process.env.GROQ_API_KEY,
          gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
          openai: !!process.env.OPENAI_API_KEY,
        });
        // Fallback response if LLM fails - include more info for debugging
        const errorMsg = llmError instanceof Error ? llmError.message : 'Unknown error';
        response = `I apologize, but I'm experiencing technical difficulties: ${errorMsg}. Please try again in a moment.`;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
        mode: mode || "natural",
        language: language || "english",
      };

      await storage.addMessageToConversation(currentSessionId, assistantMessage);

      // Post-process code in freestyle mode to clean up common issues
      if (mode === 'freestyle') {
        response = cleanupGeneratedCode(response);
      }

      res.json({
        response: response,
        sessionId: currentSessionId,
        mode,
        language
      });

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      console.error("Full error details:", error);
      res.status(500).json({
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  // Code completion endpoint for monacopilot (Mistral-powered)
  app.post("/api/code-completion", async (req, res) => {
    try {
      const { code, language = 'python', filename } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Code is required" });
      }

      // Generate code completion using Mistral
      const completion = await llmService.generateCodeCompletion(code, language, filename);

      res.json({ completion });
    } catch (error) {
      console.error("Code completion error:", error);
      res.status(500).json({ error: "Internal server error", completion: '' });
    }
  });

  // Get conversation history
  app.get("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const conversation = await storage.getConversation(sessionId);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Helper to validate file content (detect binary masquerading as text, malicious patterns)
  function validateFileContent(buffer: Buffer, mimeType: string, originalName: string): { valid: boolean; error?: string } {
    // Skip validation for audio files
    if (mimeType.startsWith('audio/') || originalName.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return { valid: true };
    }
    
    // For text files, check for binary content
    const textContent = buffer.toString('utf8');
    
    // Check for null bytes (strong indicator of binary content)
    if (textContent.includes('\0')) {
      return { valid: false, error: 'File appears to be binary, not text' };
    }
    
    // Check for control characters (except common ones like tab, newline, carriage return)
    // This allows UTF-8 international text (Japanese, Chinese, emoji, etc.)
    // Only reject files with excessive control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F)
    const controlChars = textContent.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
    const controlCharCount = controlChars ? controlChars.length : 0;
    if (textContent.length > 100 && (controlCharCount / textContent.length) > 0.01) {
      return { valid: false, error: 'File contains too many control characters' };
    }
    
    // Sanitize check: detect potential script injection in HTML files
    if (mimeType === 'text/html' || originalName.endsWith('.html')) {
      // Check for dangerous patterns (event handlers, javascript: URLs)
      const dangerousPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(textContent)) {
          console.warn(`⚠️ Potentially unsafe HTML content in ${originalName}`);
          // Don't reject, just log - user may legitimately upload HTML with scripts
          break;
        }
      }
    }
    
    return { valid: true };
  }
  
  // Helper to sanitize filename (remove path traversal, null bytes, etc.)
  function sanitizeFilename(filename: string): string {
    return filename
      .replace(/[/\\:*?"<>|]/g, '_') // Replace unsafe path chars
      .replace(/\0/g, '') // Remove null bytes
      .replace(/\.\./g, '_') // Prevent path traversal
      .slice(0, 255); // Limit length
  }

  // Configure multer for file uploads (in-memory storage)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
    },
    fileFilter: (req, file, cb) => {
      // Allow text and audio files
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'text/html',
        'text/xml',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/m4a',
      ];

      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|json|csv|html|xml|mp3|wav|ogg|m4a)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only text and audio files are allowed'));
      }
    }
  });

  // Multer error handling middleware
  const handleMulterError = (req: any, res: any, next: any) => {
    upload.array('files', 10)(req, res, (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "One or more files exceed the 5MB size limit" });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: "Too many files. Maximum 10 files allowed" });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: "Unexpected file field" });
        } else {
          return res.status(400).json({ error: err.message || "File upload error" });
        }
      }
      next();
    });
  };

  // Document upload endpoint
  app.post("/api/documents/upload", isAuthenticated, handleMulterError, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const results: any[] = [];
      const errors: any[] = [];

      // Process files in parallel for better performance
      const fileProcessingPromises = req.files.map(async (file: any) => {
        try {
          // Sanitize the filename first
          const safeOriginalName = sanitizeFilename(file.originalname);
          console.log(`📤 Processing file: ${safeOriginalName}, size: ${file.size}, mimetype: ${file.mimetype}`);
          
          // Validate file content (check for binary masquerading as text, etc.)
          const contentValidation = validateFileContent(file.buffer, file.mimetype, safeOriginalName);
          if (!contentValidation.valid) {
            return { type: 'error', file: safeOriginalName, error: contentValidation.error };
          }

          // Determine if the file is an audio file (based on mimetype or extension)
          const isAudioFile = file.mimetype.startsWith('audio/') ||
                              safeOriginalName.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/);

          // If it's an audio file, create metadata record with proper mimeType
          if (isAudioFile) {
            // Determine proper MIME type
            let mimeType = file.mimetype;
            if (!mimeType || mimeType === 'application/octet-stream') {
              // Fallback to extension-based detection
              const ext = safeOriginalName.toLowerCase().split('.').pop();
              if (ext === 'mp3') mimeType = 'audio/mpeg';
              else if (ext === 'wav') mimeType = 'audio/wav';
              else if (ext === 'ogg') mimeType = 'audio/ogg';
              else if (ext === 'm4a') mimeType = 'audio/mp4';
              else mimeType = 'audio/mpeg'; // default
            }

            console.log(`🎵 Creating audio document: ${safeOriginalName} with mimeType: ${mimeType}`);

            // Create document with metadata - mimeType is crucial for Webamp detection
            const document = await knowledgeService.processDocument(null, {
              userId,
              fileName: `${randomUUID()}-${safeOriginalName}`,
              originalName: safeOriginalName,
              fileSize: file.size.toString(),
              mimeType: mimeType,
              objectPath: undefined // Will be set by separate PUT request
            });

            console.log(`✅ Audio document created - ID: ${document.id}, name: ${document.originalName}, mimeType: ${document.mimeType}`);

            return {
              type: 'success',
              document: {
                id: document.id,
                originalName: document.originalName,
                fileSize: document.fileSize,
                mimeType: document.mimeType,
                objectPath: document.objectPath,
                summary: document.summary,
                keywords: document.keywords,
                uploadedAt: document.uploadedAt,
              }
            };
          } else {
            // For non-audio files, process as before
            const content = file.buffer.toString('utf8');

            if (content.length === 0) {
              return { type: 'error', file: safeOriginalName, error: "File is empty" };
            }

            if (content.length > 5000000) {
              return { type: 'error', file: safeOriginalName, error: "File content is too large (max 5MB)" };
            }

            console.log(`📄 Creating text document: ${safeOriginalName}`);

            const document = await knowledgeService.processDocument(content, {
              userId,
              fileName: `${randomUUID()}-${safeOriginalName}`,
              originalName: safeOriginalName,
              fileSize: file.size.toString(),
              mimeType: file.mimetype,
            });

            console.log(`✅ Text document created - ID: ${document.id}, name: ${document.originalName}`);

            return {
              type: 'success',
              document: {
                id: document.id,
                originalName: document.originalName,
                fileSize: document.fileSize,
                summary: document.summary,
                keywords: document.keywords,
                uploadedAt: document.uploadedAt,
              }
            };
          }
        } catch (fileError) {
          const safeName = sanitizeFilename(file.originalname);
          console.error(`❌ Error processing file ${safeName}:`, fileError);
          return { type: 'error', file: safeName, error: "Failed to process file" };
        }
      });

      const processingResults = await Promise.allSettled(fileProcessingPromises);

      processingResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'success') {
            results.push(result.value.document);
          } else {
            errors.push({ file: result.value.file, error: result.value.error });
          }
        } else {
          // Handle unexpected errors during Promise.allSettled
          console.error("Unexpected error in Promise.allSettled:", result);
          errors.push({ file: 'Unknown', error: "Processing failed due to an unexpected error" });
        }
      });

      res.json({
        message: `Successfully processed ${results.length} of ${req.files.length} files`,
        documents: results,
        errors: errors,
        totalUploaded: results.length,
        totalErrors: errors.length
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Save text content as document
  app.post("/api/documents/save-text", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, filename } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: "Filename is required" });
      }

      if (content.length === 0) {
        return res.status(400).json({ error: "Content cannot be empty" });
      }

      if (content.length > 5000000) {
        return res.status(400).json({ error: "Content is too large (max 5MB)" });
      }

      // Ensure filename ends with .txt if not already provided
      let finalFilename = filename;
      if (!finalFilename.toLowerCase().endsWith('.txt')) {
        finalFilename += '.txt';
      }

      // Process the document
      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName: `${randomUUID()}-${finalFilename}`,
        originalName: finalFilename,
        fileSize: Buffer.byteLength(content, 'utf8').toString(),
        mimeType: 'text/plain',
      });

      res.json({
        success: true,
        document: {
          id: document.id,
          originalName: document.originalName,
          fileSize: document.fileSize,
          summary: document.summary,
          keywords: document.keywords,
          uploadedAt: document.uploadedAt,
        }
      });
    } catch (error) {
      console.error("Save text error:", error);
      res.status(500).json({ error: "Failed to save text to knowledge base" });
    }
  });

  // Migrate documents endpoint
  app.post("/api/documents/migrate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`🔄 Migration requested by user: ${userId}`);

      const { migrateDocumentsToUser } = await import('./migrate-documents');
      const result = await migrateDocumentsToUser(userId);

      res.json({
        success: true,
        message: `Successfully migrated ${result.migrated} documents`,
        ...result
      });
    } catch (error) {
      console.error("Document migration error:", error);
      res.status(500).json({ error: "Failed to migrate documents" });
    }
  });

  // Diagnostic endpoint to check all documents in database
  app.get('/api/documents/diagnostic', isAuthenticated, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.claims.sub;
      const { db } = await import('./db');
      const { documents } = await import('@shared/schema');

      // Get ALL documents regardless of userId
      const allDocs = await db.select().from(documents);

      // Group by userId with details and show actual userId values
      const byUserId: Record<string, { count: number, documents: string[], actualUserId: string | null }> = {};
      allDocs.forEach((doc: Document) => {
        const uid = doc.userId || 'null';
        if (!byUserId[uid]) {
          byUserId[uid] = { count: 0, documents: [], actualUserId: doc.userId };
        }
        byUserId[uid].count++;
        byUserId[uid].documents.push(doc.originalName);
      });

      console.log(`📊 Total documents in database: ${allDocs.length}`);
      console.log(`📊 Your userId: ${userId}`);
      console.log(`📊 Documents by userId:`, Object.fromEntries(
        Object.entries(byUserId).map(([uid, data]) => [uid, data.count])
      ));

      const yourCount = allDocs.filter((d: Document) => d.userId === userId).length;
      const nullCount = allDocs.filter((d: Document) => !d.userId || d.userId === '').length;

      res.json({
        environment: process.env.NODE_ENV || 'development',
        totalDocuments: allDocs.length,
        yourDocuments: yourCount,
        orphanedDocuments: nullCount,
        yourUserId: userId,
        documentsByUserId: Object.fromEntries(
          Object.entries(byUserId).map(([uid, data]) => [uid, { count: data.count, actualUserId: data.actualUserId }])
        ),
        needsMigration: nullCount > 0,
        migrationAdvice: nullCount > 0 ? `Click "Migrate Docs" button to assign ${nullCount} orphaned documents to your account` : 'No migration needed',
        sampleOrphanedDocs: allDocs.filter((d: Document) => !d.userId || d.userId === '').slice(0, 5).map((d: Document) => ({
          id: d.id,
          name: d.originalName,
          userId: d.userId
        }))
      });
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(500).json({ error: "Failed to run diagnostic", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  // Get user documents
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`📚 Fetching documents for user: ${userId}`);
      const documents = await storage.getUserDocuments(userId);
      console.log(`📚 Found ${documents.length} documents for user ${userId}`);

      // Return all necessary fields including mimeType, objectPath, and personality training status
      const documentsInfo = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        summary: doc.summary,
        keywords: doc.keywords,
        uploadedAt: doc.uploadedAt,
        lastAccessedAt: doc.lastAccessedAt,
        mimeType: doc.mimeType || null,
        objectPath: doc.objectPath || null,
        isPersonality: doc.isPersonality || false,
      }));

      res.json(documentsInfo);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Toggle document personality training status
  app.patch("/api/documents/:id/personality", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      const { isPersonality } = req.body;

      if (typeof isPersonality !== 'boolean') {
        return res.status(400).json({ error: "isPersonality must be a boolean" });
      }

      const success = await knowledgeService.toggleDocumentPersonality(documentId, userId, isPersonality);

      if (!success) {
        return res.status(404).json({ error: "Document not found or access denied" });
      }

      console.log(`🧠 Document ${documentId} personality training: ${isPersonality ? 'enabled' : 'disabled'}`);
      res.json({ success: true, isPersonality });
    } catch (error) {
      console.error("Toggle personality error:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Export all user documents as JSON (for backup/sync between environments)
  app.get("/api/documents/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`📤 Exporting documents for user: ${userId}`);

      const documents = await storage.getUserDocuments(userId);

      // Export full document data (excluding IDs which will be regenerated on import)
      const exportData = {
        exportedAt: new Date().toISOString(),
        documentCount: documents.length,
        documents: documents.map(doc => ({
          originalName: doc.originalName,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          content: doc.content,
          summary: doc.summary,
          keywords: doc.keywords,
          objectPath: doc.objectPath,
          isNote: doc.isNote,
        }))
      };

      console.log(`📤 Exported ${documents.length} documents`);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="archimedes-documents-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Export documents error:", error);
      res.status(500).json({ error: "Failed to export documents" });
    }
  });

  // Import documents from JSON (for restoring backups or syncing between environments)
  const importDocumentSchema = z.object({
    originalName: z.string().min(1).max(500),
    fileName: z.string().optional(),
    fileSize: z.string().optional(),
    mimeType: z.string().optional(),
    content: z.string().max(10000000), // Max 10MB of text content
    summary: z.string().nullable().optional(),
    keywords: z.array(z.string()).nullable().optional(),
    objectPath: z.string().nullable().optional(),
    isNote: z.boolean().optional(),
  });

  const importRequestSchema = z.object({
    documents: z.array(importDocumentSchema).max(500), // Max 500 documents per import
  });

  app.post("/api/documents/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request body with Zod
      const parseResult = importRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid import data format",
          details: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }

      const { documents } = parseResult.data;

      console.log(`📥 Importing ${documents.length} documents for user: ${userId}`);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const skippedNames: string[] = [];

      for (const doc of documents) {
        try {
          // Check if document with same name already exists
          const existing = await storage.getDocumentByFilename(userId, doc.originalName);
          if (existing) {
            skipped++;
            skippedNames.push(doc.originalName);
            continue;
          }

          // Create new document with server-controlled timestamps
          await storage.createDocument({
            userId,
            originalName: doc.originalName,
            fileName: doc.fileName || doc.originalName,
            fileSize: doc.fileSize || '0',
            mimeType: doc.mimeType || 'text/plain',
            content: doc.content || '',
            summary: doc.summary || null,
            keywords: doc.keywords || [],
            objectPath: doc.objectPath || null,
            isNote: doc.isNote || false,
          });
          imported++;
        } catch (docError) {
          errors.push(`Failed to import "${doc.originalName}": ${docError instanceof Error ? docError.message : 'Unknown error'}`);
        }
      }

      console.log(`📥 Import complete: ${imported} imported, ${skipped} skipped (already exist), ${errors.length} errors`);

      res.json({
        success: true,
        imported,
        skipped,
        skippedNames: skippedNames.length > 0 ? skippedNames : undefined,
        errors: errors.length > 0 ? errors : undefined,
        message: `Imported ${imported} documents. ${skipped} skipped (already exist).`
      });
    } catch (error) {
      console.error("Import documents error:", error);
      res.status(500).json({ error: "Failed to import documents" });
    }
  });

  // Get single document with full content
  app.get("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Rename a specific document
  app.patch("/api/documents/:documentId/rename", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { newName } = req.body;

      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: "Valid document name is required" });
      }

      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found or unauthorized" });
      }

      const updatedDocument = await storage.updateDocument(documentId, {
        originalName: newName.trim()
      });

      res.json({ success: true, document: updatedDocument });
    } catch (error) {
      console.error("Rename document error:", error);
      res.status(500).json({ error: "Failed to rename document" });
    }
  });


  // Delete a specific document
  app.delete("/api/documents/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;

      const success = await knowledgeService.deleteDocument(documentId, userId);

      if (!success) {
        return res.status(404).json({ error: "Document not found or unauthorized" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Get document by filename for read command
  app.get("/api/documents/read/:filename", isAuthenticated, async (req: any, res) => {
    try {
      const filename = req.params.filename;
      const userId = req.user.claims.sub;

      const document = await storage.getDocumentByFilename(userId, filename);
      if (!document) {
        return res.status(404).json({
          error: `Document '${filename}' not found`,
          formatted: `❌ Document '${filename}' not found in knowledge base.\n\nUse 'docs' command to list available documents.`
        });
      }

      res.json({
        document,
        formatted: `📖 Reading: ${document.originalName}\n\n${document.content}\n\n📊 Summary: ${document.summary || 'No summary available'}\n🏷️  Keywords: ${document.keywords?.join(', ') || 'None'}`
      });
    } catch (error) {
      console.error("Read document error:", error);
      res.status(500).json({
        error: "Failed to read document",
        formatted: "❌ Failed to read document. Please try again."
      });
    }
  });

  // Search documents and knowledge
  app.get("/api/knowledge/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const results = await knowledgeService.searchKnowledge(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Knowledge search error:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // Get user document statistics
  app.get("/api/knowledge/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await knowledgeService.getUserDocumentStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Knowledge stats error:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base statistics" });
    }
  });

  // Save a note
  app.post("/api/notes", isAuthenticated, async (req: any, res) => {
    try {
      // Ensure user is authenticated
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.claims.sub;
      const { title, content } = req.body;

      console.log('📝 Saving note:', { userId, titleLength: title?.length, contentLength: content?.length });

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: "Valid title is required" });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Valid content is required" });
      }

      const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName,
        originalName: title,
        fileSize: Buffer.byteLength(content, 'utf8').toString(),
        mimeType: 'text/plain',
      });

      // Mark as note
      await storage.updateDocument(document.id, { isNote: true });

      console.log('✅ Note saved successfully:', document.id);

      res.json({
        success: true,
        document: { ...document, isNote: true },
        message: "Note saved to knowledge base"
      });
    } catch (error) {
      console.error("❌ Save note error:", error);
      res.status(500).json({
        error: "Failed to save note",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a note
  app.put("/api/notes/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { title, content } = req.body;

      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId || !document.isNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      const fileName = title ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt` : document.fileName;

      await storage.updateDocument(documentId, {
        originalName: title || document.originalName,
        fileName,
        content: content || document.content,
        fileSize: (content?.length || document.content.length).toString(),
      });

      res.json({ success: true, message: "Note updated" });
    } catch (error) {
      console.error("Update note error:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  // Save AI response to knowledge base with personality training flag
  app.post("/api/knowledge/train", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, title } = req.body;

      const trimmedContent = content?.trim?.() || '';
      if (!trimmedContent || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      // Generate title from content if not provided or empty
      const trimmedTitle = title?.trim?.() || '';
      const docTitle = trimmedTitle || `AI Training - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      const fileName = `ai-training-${Date.now()}.txt`;

      // Process and create document
      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName,
        originalName: docTitle,
        fileSize: Buffer.byteLength(content, 'utf8').toString(),
        mimeType: 'text/plain',
      });

      // Mark as personality training content
      await storage.updateDocument(document.id, { isPersonality: true });

      console.log(`🧠 AI training content saved: ${document.id} for user ${userId}`);

      res.json({
        success: true,
        document: { ...document, isPersonality: true },
        message: "Response saved for AI training"
      });
    } catch (error) {
      console.error("Save AI training error:", error);
      res.status(500).json({ error: "Failed to save training content" });
    }
  });

  // Download a specific document (for audio files)
  app.get("/api/knowledge/documents/:documentId/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;

      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found" });
      }

      // If it's an audio file with object storage path, stream it
      if (document.objectPath && document.mimeType && document.mimeType.startsWith('audio/')) {
        const objectStorageService = new ObjectStorageService();

        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
          await objectStorageService.downloadObject(objectFile, res, 86400); // Cache for 24 hours
        } catch (error) {
          console.error("Error accessing object storage:", error);
          res.status(404).json({ error: "Audio file not found in storage" });
        }
      } else {
        res.status(400).json({ error: "Document is not downloadable or not an audio file" });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // Wallpaper API endpoints
  app.get("/api/wallpapers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallpapers = await storage.getUserWallpapers(userId);
      res.json(wallpapers);
    } catch (error) {
      console.error("Get wallpapers error:", error);
      res.status(500).json({ error: "Failed to fetch wallpapers" });
    }
  });

  app.post("/api/wallpapers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, dataUrl, objectPath } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Wallpaper name is required" });
      }

      if (!dataUrl && !objectPath) {
        return res.status(400).json({ error: "Either dataUrl or objectPath is required" });
      }

      const wallpaper = await storage.createWallpaper({
        id: randomUUID(),
        userId,
        name,
        dataUrl: dataUrl || null,
        objectPath: objectPath || null,
        isSelected: false,
      });

      res.json(wallpaper);
    } catch (error) {
      console.error("Create wallpaper error:", error);
      res.status(500).json({ error: "Failed to create wallpaper" });
    }
  });

  app.delete("/api/wallpapers/:wallpaperId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { wallpaperId } = req.params;

      const success = await storage.deleteWallpaper(wallpaperId, userId);

      if (!success) {
        return res.status(404).json({ error: "Wallpaper not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete wallpaper error:", error);
      res.status(500).json({ error: "Failed to delete wallpaper" });
    }
  });

  app.post("/api/wallpapers/:wallpaperId/select", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { wallpaperId } = req.params;

      const success = await storage.setSelectedWallpaper(wallpaperId, userId);

      if (!success) {
        return res.status(404).json({ error: "Wallpaper not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Select wallpaper error:", error);
      res.status(500).json({ error: "Failed to select wallpaper" });
    }
  });

  app.post("/api/wallpapers/clear-selection", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearSelectedWallpaper(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Clear wallpaper selection error:", error);
      res.status(500).json({ error: "Failed to clear selection" });
    }
  });

  // Object Storage endpoints for knowledge base files
  // Reference: blueprint:javascript_object_storage

  // Get upload URL for object storage
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Serve private objects with ACL checks
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        return res.sendStatus(401);
      }

      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Update document with object storage path and ACL
  app.put("/api/documents/:id/object", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      const { objectURL } = req.body;

      if (!objectURL) {
        return res.status(400).json({ error: "objectURL is required" });
      }

      const objectStorageService = new ObjectStorageService();

      // Set ACL policy for the uploaded file
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectURL,
        {
          owner: userId,
          visibility: "private",
        }
      );

      // Update document with object storage path
      await storage.updateDocument(documentId, { objectPath });

      res.status(200).json({
        objectPath: objectPath,
        message: "Document object storage updated successfully",
      });
    } catch (error) {
      console.error("Error updating document object:", error);
      res.status(500).json({ error: "Failed to update document object storage" });
    }
  });

  // Weather API endpoint
  app.get("/api/weather", async (req, res) => {
    try {
      const location = req.query.location as string;
      let weather;

      if (req.query.lat && req.query.lon) {
        const lat = parseFloat(req.query.lat as string);
        const lon = parseFloat(req.query.lon as string);

        if (isNaN(lat) || isNaN(lon)) {
          return res.status(400).json({ error: "Invalid latitude or longitude" });
        }

        weather = await weatherService.getWeatherByCoordinates(lat, lon);
      } else {
        weather = await weatherService.getCurrentWeather(location);
      }

      const formattedWeather = weatherService.formatCurrentWeather(weather);

      res.json({
        weather,
        formatted: formattedWeather
      });
    } catch (error) {
      console.error("Weather error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch weather data";
      res.status(500).json({ error: message });
    }
  });

  // Research API endpoint using Brave Search
  app.get("/api/research", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const braveApiKey = process.env.BRAVE_API_KEY;
      if (!braveApiKey) {
        return res.status(500).json({ error: "Brave API key not configured" });
      }

      // Call Brave Search API with minimal parameters to avoid 422 error
      const searchParams = new URLSearchParams({
        q: query.trim(),
        count: '10'
      });

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey,
          'User-Agent': 'Archimedes/1.0'
        }
      });

      if (!response.ok) {
        // Capture the actual error response from Brave API
        const errorText = await response.text();
        console.error(`Brave API detailed error: ${response.status} ${response.statusText} | ${errorText}`);

        // Return 400 for client errors (422) instead of 500
        const statusCode = response.status === 422 ? 400 : 500;
        return res.status(statusCode).json({
          error: `Brave API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }

      const data = await response.json();

      // Format results for terminal display
      const formattedResults = {
        query: query.trim(),
        total_results: data.web?.results?.length || 0,
        results: data.web?.results?.slice(0, 10).map((result: any, index: number) => ({
          rank: index + 1,
          title: result.title || 'No title',
          url: result.url || '',
          description: result.description || 'No description available',
          age: result.age || null,
          published: result.published || null
        })) || [],
        search_time: new Date().toISOString()
      };

      res.json(formattedResults);
    } catch (error) {
      console.error("Research API error:", error);
      const message = error instanceof Error ? error.message : "Failed to perform web search";
      res.status(500).json({ error: message });
    }
  });

  // Gutendx (Project Gutenberg) API endpoints
  app.get("/api/books/search", async (req, res) => {
    try {
      const {
        search,
        languages,
        author_year_start,
        author_year_end,
        copyright,
        topic,
        sort,
        page
      } = req.query;

      const params: any = {};

      if (search) params.search = search as string;
      if (languages) {
        // Handle comma-separated languages
        params.languages = (languages as string).split(',').map(l => l.trim());
      }
      if (author_year_start) params.author_year_start = parseInt(author_year_start as string);
      if (author_year_end) params.author_year_end = parseInt(author_year_end as string);
      if (copyright !== undefined) params.copyright = copyright === 'true';
      if (topic) params.topic = topic as string;
      if (sort) params.sort = sort as 'popular' | 'ascending' | 'descending';
      if (page) params.page = parseInt(page as string);

      const response = await gutendxService.searchBooks(params);
      const formatted = gutendxService.formatSearchResults(response, search as string);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Book search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const response = await gutendxService.getPopularBooks(limit);
      const formatted = gutendxService.formatSearchResults(response);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Popular books error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch popular books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);

      if (isNaN(bookId)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }

      const book = await gutendxService.getBook(bookId);
      const formatted = gutendxService.formatBookForTerminal(book);

      res.json({
        book,
        formatted
      });
    } catch (error) {
      console.error("Get book error:", error);
      const message = error instanceof Error ? error.message : "Failed to get book details";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/author/:name", async (req, res) => {
    try {
      const authorName = req.params.name;
      const response = await gutendxService.getBooksByAuthor(authorName);
      const formatted = gutendxService.formatSearchResults(response, `author: ${authorName}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by author error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by author";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/topic/:topic", async (req, res) => {
    try {
      const topic = req.params.topic;
      const response = await gutendxService.getBooksByTopic(topic);
      const formatted = gutendxService.formatSearchResults(response, `topic: ${topic}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by topic error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by topic";
      res.status(500).json({ error: message });
    }
  });

  // Marketstack (Stock Market Data) API endpoints
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const quote = await marketstackService.getLatestQuote(symbol);

      if (!quote) {
        return res.status(404).json({ error: `No data found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatQuoteForTerminal(quote);

      res.json({
        quote,
        formatted
      });
    } catch (error) {
      console.error("Stock quote error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quote";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/stocks/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;

      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: "Symbols array is required" });
      }

      if (symbols.length > 10) {
        return res.status(400).json({ error: "Maximum 10 symbols allowed per request" });
      }

      const quotes = await marketstackService.getMultipleQuotes(symbols);
      const formatted = marketstackService.formatMultipleQuotesForTerminal(quotes);

      res.json({
        quotes,
        formatted
      });
    } catch (error) {
      console.error("Multiple stock quotes error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quotes";
      res.status(500).json({ error: message });
    }
  });

  // Python code execution endpoint (duplicate - for Workshop IDE)
  app.post('/api/execute/python', executeRateLimitMiddleware, async (req, res) => {
    try {
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Code is required and must be a string'
        });
      }

      // Check if code uses GUI libraries
      const hasGuiLibraries = /import\s+(tkinter|matplotlib|pygame|turtle|PyQt|PySide)/i.test(code);

      // Wrap GUI code to capture output as HTML/image
      const wrappedCode = hasGuiLibraries ? `
import sys
import io
import base64

# Capture GUI output
_gui_output = None

${code}

# For matplotlib, capture plot as base64 image
try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        print(f'__GUI_OUTPUT__:<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;" />')
        plt.close('all')
except ImportError:
    pass
except Exception as e:
    print(f'GUI rendering error: {e}', file=sys.stderr)

# For tkinter, we can't render in headless but we'll note it
try:
    import tkinter as tk
    if tk._default_root:
        print('__GUI_OUTPUT__:<div style="padding:20px; background:#f0f0f0; border-radius:8px;"><strong>🖼️ Tkinter GUI Application</strong><br/>GUI window was created but cannot be displayed in headless mode.<br/>Run this code locally to see the interface.</div>')
except:
    pass
` : code;

      const startTime = Date.now();
      const timeout = 120000; // 2 minute timeout for large programs

      const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', wrappedCode]);
        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          pythonProcess.kill();
          reject(new Error('Execution timeout (2 minutes) - Code took too long to execute'));
        }, timeout);

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
          clearTimeout(timer);
          if (!killed) {
            resolve({ stdout, stderr, code: code || 0 });
          }
        });

        pythonProcess.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // Extract GUI output if present
      let guiOutput = null;
      let textOutput = result.stdout;
      const guiMatch = result.stdout.match(/__GUI_OUTPUT__:(.*)/);
      if (guiMatch) {
        guiOutput = guiMatch[1];
        textOutput = result.stdout.replace(/__GUI_OUTPUT__:.*/, '').trim();
      }

      if (result.code !== 0) {
        return res.json({
          success: false,
          error: result.stderr,
          output: textOutput,
          guiOutput,
          executionTime
        });
      }

      res.json({
        success: true,
        output: textOutput,
        guiOutput,
        executionTime
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      });
    }
  });

  app.get("/api/stocks/info/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const info = await marketstackService.getTickerInfo(symbol);

      if (!info) {
        return res.status(404).json({ error: `No company information found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatTickerInfoForTerminal(info);

      res.json({
        info,
        formatted
      });
    } catch (error) {
      console.error("Stock info error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock information";
      res.status(500).json({ error: message });
    }
  });


  app.get("/api/stocks/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const limit = parseInt(req.query.limit as string) || 10;

      const tickers = await marketstackService.searchTickers(query, limit);

      if (tickers.length === 0) {
        return res.json({
          tickers: [],
          formatted: `No stocks found matching "${query}". Try different keywords or check the symbol.`
        });
      }

      const formatted = `Stock Search Results for "${query}":\n\n` +
        tickers.map((ticker, index) =>
          `${index + 1}. ${ticker.symbol} - ${ticker.name}\n   Exchange: ${ticker.stock_exchange.name} (${ticker.country})`
        ).join('\n\n') +
        `\n\nUse 'stock quote <symbol>' to get current prices.`;

      res.json({
        tickers,
        formatted
      });
    } catch (error) {
      console.error("Stock search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search stocks";
      res.status(500).json({ error: message });
    }
  });

  // Semantic Scholar API endpoints
  app.get("/api/scholar/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const results = await scholarService.searchPapers(query, limit, offset);
      const formatted = scholarService.formatSearchResultsForTerminal(results, query);

      res.json({
        results,
        formatted
      });
    } catch (error) {
      console.error("Scholar search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search academic papers";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/scholar/paper/:paperId", async (req, res) => {
    try {
      const paperId = req.params.paperId;
      const paper = await scholarService.getPaperDetails(paperId);
      const formatted = scholarService.formatPaperDetailsForTerminal(paper);

      res.json({
        paper,
        formatted
      });
    } catch (error) {
      console.error("Scholar paper details error:", error);
      const message = error instanceof Error ? error.message : "Failed to get paper details";
      res.status(500).json({ error: message });
    }
  });

  // OSINT API routes
  app.get('/api/osint/whois/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain) || domain.length > 253) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 WHOIS lookup for: ${domain}`);
      }

      // Try RDAP first (more reliable and standardized)
      try {
        const rdapResponse = await fetch(`https://rdap.org/domain/${domain}`, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
        });

        if (rdapResponse.ok) {
          const rdapData = await rdapResponse.json();

          let formatted = `╭─ WHOIS Information for ${domain}\n`;
          formatted += `├─ Domain: ${domain}\n`;

          // Extract registrar from entities
          const registrar = rdapData.entities?.find((entity: any) =>
            entity.roles?.includes('registrar'))?.vcardArray?.[1]?.find((item: any) =>
              item[0] === 'fn')?.[3];
          if (registrar) {
            formatted += `├─ Registrar: ${registrar}\n`;
          }

          // Extract dates from events
          if (rdapData.events) {
            const registration = rdapData.events.find((event: any) => event.eventAction === 'registration');
            const expiration = rdapData.events.find((event: any) => event.eventAction === 'expiration');
            const lastChanged = rdapData.events.find((event: any) => event.eventAction === 'last changed');

            if (registration?.eventDate) {
              formatted += `├─ Creation Date: ${registration.eventDate.split('T')[0]}\n`;
            }
            if (expiration?.eventDate) {
              formatted += `├─ Expiration Date: ${expiration.eventDate.split('T')[0]}\n`;
            }
            if (lastChanged?.eventDate) {
              formatted += `├─ Updated Date: ${lastChanged.eventDate.split('T')[0]}\n`;
            }
          }

          // Extract status
          if (rdapData.status) {
            formatted += `├─ Domain Status: ${rdapData.status.join(', ')}\n`;
          }

          // Extract nameservers
          if (rdapData.nameservers) {
            const nameServers = rdapData.nameservers.map((ns: any) => ns.ldhName).slice(0, 4);
            if (nameServers.length > 0) {
              formatted += `├─ Name Servers: ${nameServers.join(', ')}\n`;
            }
          }

          formatted += `╰─ Query completed using RDAP`;
          res.json({ formatted });
          return;
        }
      } catch (rdapError) {
        console.log('RDAP failed, trying WHOIS API fallback');
      }

      // Fallback to whois.vu API
      try {
        const whoisResponse = await fetch(`https://api.whois.vu/?q=${domain}`, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
        });

        if (whoisResponse.ok) {
          const whoisData = await whoisResponse.json();

          let formatted = `╭─ WHOIS Information for ${domain}\n`;
          formatted += `├─ Domain: ${domain}\n`;

          if (whoisData.registrar) {
            formatted += `├─ Registrar: ${whoisData.registrar}\n`;
          }
          if (whoisData.registered) {
            formatted += `├─ Creation Date: ${whoisData.registered}\n`;
          }
          if (whoisData.expires) {
            formatted += `├─ Expiration Date: ${whoisData.expires}\n`;
          }
          if (whoisData.updated) {
            formatted += `├─ Updated Date: ${whoisData.updated}\n`;
          }
          if (whoisData.nameservers && whoisData.nameservers.length > 0) {
            formatted += `├─ Name Servers: ${whoisData.nameservers.slice(0, 4).join(', ')}\n`;
          }
          if (whoisData.status) {
            const status = Array.isArray(whoisData.status) ? whoisData.status.join(', ') : whoisData.status;
            formatted += `├─ Domain Status: ${status}\n`;
          }

          formatted += `╰─ Query completed using WHOIS API`;
          res.json({ formatted });
          return;
        }
      } catch (whoisApiError) {
        console.log('WHOIS API failed, falling back to DNS-only lookup');
      }

      // Final fallback: Enhanced DNS-only information
      try {
        let formatted = `╭─ Domain Information for ${domain}\n`;
        let hasData = false;

        // Get A records
        try {
          const addresses = await dns.resolve4(domain);
          formatted += `├─ IPv4 Addresses: ${addresses.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        // Get AAAA records
        try {
          const ipv6Addresses = await dns.resolve6(domain);
          formatted += `├─ IPv6 Addresses: ${ipv6Addresses.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        // Get MX records
        try {
          const mxRecords = await dns.resolveMx(domain);
          const mxList = mxRecords.map(mx => `${mx.exchange} (${mx.priority})`).join(', ');
          formatted += `├─ Mail Servers: ${mxList}\n`;
          hasData = true;
        } catch (e) {}

        // Get NS records
        try {
          const nsRecords = await dns.resolveNs(domain);
          formatted += `├─ Name Servers: ${nsRecords.join(', ')}\n`;
          hasData = true;
        } catch (e) {}

        if (hasData) {
          formatted += `╰─ DNS resolution complete (WHOIS services unavailable)`;
          res.json({ formatted });
        } else {
          res.json({
            formatted: `╭─ Domain lookup for ${domain}\n╰─ Domain does not resolve or is not accessible`
          });
        }
      } catch (finalError) {
        res.json({
          formatted: `╭─ Domain lookup for ${domain}\n╰─ All lookup methods failed - domain may not exist`
        });
      }
    } catch (error) {
      console.error('WHOIS error:', error);
      res.status(500).json({ error: 'WHOIS lookup failed' });
    }
  });

  app.get("/api/osint/dns/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      // DNS module imported at top of file

      const results: {
        A: string[];
        AAAA: string[];
        MX: Array<{exchange: string, priority: number}>;
        TXT: string[][];
        NS: string[];
        CNAME: string[] | null;
      } = {
        A: [],
        AAAA: [],
        MX: [],
        TXT: [],
        NS: [],
        CNAME: null
      };

      try {
        // Get A records
        try {
          results.A = await dns.resolve4(domain);
        } catch (e) {}

        // Get AAAA records
        try {
          results.AAAA = await dns.resolve6(domain);
        } catch (e) {}

        // Get MX records
        try {
          results.MX = await dns.resolveMx(domain);
        } catch (e) {}

        // Get TXT records
        try {
          results.TXT = await dns.resolveTxt(domain);
        } catch (e) {}

        // Get NS records
        try {
          results.NS = await dns.resolveNs(domain);
        } catch (e) {}

        // Get CNAME
        try {
          results.CNAME = await dns.resolveCname(domain);
        } catch (e) {}

        let formatted = `╭─ DNS Records for ${domain}\n`;

        if (results.A.length) {
          formatted += `├─ A Records: ${results.A.join(', ')}\n`;
        }

        if (results.AAAA.length) {
          formatted += `├─ AAAA Records: ${results.AAAA.join(', ')}\n`;
        }

        if (results.MX.length) {
          formatted += `├─ MX Records: ${results.MX.map(mx => `${mx.exchange} (${mx.priority})`).join(', ')}\n`;
        }

        if (results.NS.length) {
          formatted += `├─ NS Records: ${results.NS.join(', ')}\n`;
        }

        if (results.TXT.length) {
          formatted += `├─ TXT Records: ${results.TXT.map(txt => txt.join(' ')).join(', ')}\n`;
        }

        if (results.CNAME) {
          formatted += `├─ CNAME: ${results.CNAME.join(', ')}\n`;
        }

        formatted += `╰─ DNS lookup complete`;

        res.json({ formatted });

      } catch (error) {
        res.json({ formatted: `╭─ DNS lookup for ${domain}\n╰─ No DNS records found or domain does not exist` });
      }
    } catch (error) {
      console.error('DNS error:', error);
      res.status(500).json({ error: 'DNS lookup failed' });
    }
  });

  app.get("/api/osint/geoip/:ip", async (req, res) => {
    try {
      const { ip } = req.params;

      // Basic IP validation
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      try {
        // Use ip-api.com free service
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
        const data = await response.json();

        if (data.status === 'success') {
          const formatted = `
╭─ IP Geolocation for ${ip}
├─ Country: ${data.country} (${data.countryCode})
├─ Region: ${data.regionName} (${data.region})
├─ City: ${data.city}
├─ Postal Code: ${data.zip || 'N/A'}
├─ Coordinates: ${data.lat}, ${data.lon}
├─ Timezone: ${data.timezone}
├─ ISP: ${data.isp}
├─ Organization: ${data.org}
╰─ AS: ${data.as}`;

          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation data not available for this IP` });
        }
      } catch (apiError) {
        res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation service temporarily unavailable` });
      }
    } catch (error) {
      console.error('GeoIP error:', error);
      res.status(500).json({ error: 'IP geolocation failed' });
    }
  });

  app.get('/api/osint/headers', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      // Basic URL validation
      let targetUrl: URL;
      try {
        targetUrl = new URL(url);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'ARCHIMEDES-OSINT/1.0'
          }
        });

        let formatted = `╭─ HTTP Headers for ${url}\n`;
        formatted += `├─ Status: ${response.status} ${response.statusText}\n`;

        response.headers.forEach((value, key) => {
          formatted += `├─ ${key}: ${value}\n`;
        });

        formatted += `╰─ Header analysis complete`;

        res.json({ formatted });

      } catch (fetchError) {
        res.json({ formatted: `╭─ HTTP Headers for ${url}\n╰─ Unable to fetch headers - site may be unreachable` });
      }
    } catch (error) {
      console.error('Headers error:', error);
      res.status(500).json({ error: 'Header analysis failed' });
    }
  });

  app.get('/api/osint/wayback', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      try {
        // Use Wayback Machine CDX API
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=10&sort=timestamp`;
        const response = await fetch(cdxUrl);
        const data = await response.json();

        if (data && data.length > 1) {
          let formatted = `╭─ Wayback Machine snapshots for ${url}\n`;

          // Skip first row which contains headers
          const snapshots = data.slice(1, 6); // Show max 5 snapshots

          snapshots.forEach((snapshot: any, index: number) => {
            const timestamp = snapshot[1];
            const date = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)} ${timestamp.slice(8,10)}:${timestamp.slice(10,12)}`;
            const statusCode = snapshot[4];
            const archiveUrl = `https://web.archive.org/web/${timestamp}/${url}`;

            formatted += `├─ ${index + 1}. ${date} (Status: ${statusCode})\n`;
            formatted += `│   ${archiveUrl}\n`;
          });

          formatted += `╰─ Found ${data.length - 1} total snapshots`;

          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ No archived snapshots found` });
        }

      } catch (apiError) {
        res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ Archive service temporarily unavailable` });
      }
    } catch (error) {
      console.error('Wayback error:', error);
      res.status(500).json({ error: 'Wayback lookup failed' });
    }
  });

  app.get('/api/osint/username/:username', async (req, res) => {
    try {
      const { username } = req.params;

      // Basic username validation
      const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
      if (!usernameRegex.test(username) || username.length < 1 || username.length > 30) {
        return res.status(400).json({ error: 'Invalid username format' });
      }

      // List of platforms to check
      const platforms = [
        { name: 'GitHub', url: `https://github.com/${username}`, checkType: 'status' },
        { name: 'Twitter', url: `https://twitter.com/${username}`, checkType: 'status' },
        { name: 'Instagram', url: `https://instagram.com/${username}`, checkType: 'status' },
        { name: 'Reddit', url: `https://reddit.com/user/${username}`, checkType: 'status' },
        { name: 'YouTube', url: `https://youtube.com/@${username}`, checkType: 'status' },
        { name: 'Medium', url: `https://medium.com/@${username}`, checkType: 'status' },
        { name: 'LinkedIn', url: `https://linkedin.com/in/${username}`, checkType: 'status' }
      ];

      let formatted = `╭─ Username availability check: ${username}\n`;

      const checks = await Promise.allSettled(
        platforms.map(async (platform) => {
          try {
            const response = await fetch(platform.url, {
              method: 'HEAD',
              redirect: 'follow',
              headers: {
                'User-Agent': 'ARCHIMEDES-OSINT/1.0'
              }
            });

            const exists = response.status === 200;
            return { platform: platform.name, exists, status: response.status };
          } catch (error) {
            return { platform: platform.name, exists: false, status: 'error' };
          }
        })
      );

      checks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { platform, exists, status } = result.value;
          const indicator = exists ? '❌' : '✅';
          const statusText = exists ? 'Taken' : 'Available';
          formatted += `├─ ${indicator} ${platform}: ${statusText}\n`;
        } else {
          formatted += `├─ ⚠️  ${platforms[index].name}: Check failed\n`;
        }
      });

      formatted += `╰─ Username check complete`;

      res.json({ formatted });

    } catch (error) {
      console.error('Username check error:', error);
      res.status(500).json({ error: 'Username check failed' });
    }
  });

  // Simple test endpoint
  app.get('/api/osint/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
  });

  // Traceroute OSINT endpoint
  app.get('/api/osint/traceroute/:target', async (req, res) => {
    const { target } = req.params;

    // Simple validation
    if (!target || target.length === 0) {
      return res.status(400).json({ error: 'Target required' });
    }

    try {
      // Try DNS resolution first
      const addresses = await dns.resolve4(target);

      let formatted = `╭─ Network Analysis for ${target}\n`;
      formatted += `├─ DNS Resolution: SUCCESS\n`;
      formatted += `├─ Resolved to: ${addresses[0]}\n`;
      if (addresses.length > 1) {
        formatted += `├─ Additional IPs: ${addresses.slice(1).join(', ')}\n`;
      }
      formatted += `├─ Status: System traceroute not available\n`;
      formatted += `├─ Note: Basic network connectivity confirmed via DNS\n`;
      formatted += `╰─ Analysis complete`;

      res.json({ formatted });

    } catch (error: any) {
      let formatted = `╭─ Network Analysis for ${target}\n`;
      formatted += `├─ DNS Resolution: FAILED\n`;
      formatted += `├─ Error: Target unreachable or invalid\n`;
      formatted += `╰─ Analysis complete`;

      res.json({ formatted });
    }
  });

  // Subdomain enumeration OSINT endpoint
  app.get('/api/osint/subdomains/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ Subdomain Enumeration for ${domain}\n`;

      // Common subdomain wordlist
      const commonSubdomains = [
        'www', 'mail', 'email', 'webmail', 'admin', 'administrator', 'login',
        'api', 'app', 'apps', 'dev', 'development', 'test', 'testing', 'stage', 'staging',
        'prod', 'production', 'blog', 'forum', 'shop', 'store', 'cdn', 'static',
        'assets', 'media', 'images', 'img', 'js', 'css', 'files', 'downloads',
        'ftp', 'sftp', 'ssh', 'vpn', 'remote', 'secure', 'ssl', 'tls',
        'db', 'database', 'mysql', 'postgres', 'redis', 'mongo', 'elasticsearch',
        'search', 'help', 'support', 'docs', 'documentation', 'wiki',
        'mobile', 'm', 'beta', 'alpha', 'demo', 'preview', 'portal'
      ];

      const foundSubdomains: string[] = [];
      const maxConcurrent = 5;

      // Process subdomains in batches to avoid overwhelming DNS
      for (let i = 0; i < commonSubdomains.length; i += maxConcurrent) {
        const batch = commonSubdomains.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(async (subdomain) => {
          const fullDomain = `${subdomain}.${domain}`;
          try {
            const addresses = await dns.resolve4(fullDomain);
            if (addresses && addresses.length > 0) {
              return { subdomain: fullDomain, ip: addresses[0] };
            }
          } catch (error) {
            // Subdomain doesn't exist, ignore
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result) {
            foundSubdomains.push(`${result.subdomain} → ${result.ip}`);
          }
        });

        // Small delay between batches to be respectful
        if (i + maxConcurrent < commonSubdomains.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (foundSubdomains.length > 0) {
        formatted += `├─ Found ${foundSubdomains.length} active subdomains:\n`;
        foundSubdomains.forEach((subdomain, index) => {
          const prefix = index === foundSubdomains.length - 1 ? '╰─' : '├─';
          formatted += `${prefix} ${subdomain}\n`;
        });
      } else {
        formatted += `├─ No common subdomains discovered\n`;
        formatted += `╰─ Try advanced enumeration tools for comprehensive scanning`;
      }

      if (foundSubdomains.length > 0 && foundSubdomains.length < commonSubdomains.length) {
        formatted += `╰─ Scanned ${commonSubdomains.length} common patterns`;
      }

      res.json({ formatted });

    } catch (error) {
      console.error('Subdomain enumeration error:', error);
      res.status(500).json({ error: 'Subdomain enumeration failed' });
    }
  });

  // SSL/TLS Certificate Analysis endpoint
  app.get('/api/osint/ssl/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ SSL/TLS Certificate Analysis for ${domain}\n`;

      try {
        // Get certificate information via HTTPS connection (using imported https module)
        const checkSSL = new Promise((resolve, reject) => {
          const options = {
            hostname: domain,
            port: 443,
            method: 'HEAD',
            timeout: 10000,
            rejectUnauthorized: false // Allow self-signed certs for analysis
          };

          const req = https.request(options, (res: any) => {
            const cert = res.connection.getPeerCertificate(true);
            resolve(cert);
          });

          req.on('error', (error: any) => {
            reject(error);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('SSL connection timeout'));
          });

          req.end();
        });

        const cert: any = await checkSSL;

        if (cert && cert.subject) {
          formatted += `├─ Certificate Found: ✅\n`;
          formatted += `├─ Subject: ${cert.subject.CN || 'N/A'}\n`;
          formatted += `├─ Issuer: ${cert.issuer.CN || cert.issuer.O || 'Unknown'}\n`;
          formatted += `├─ Valid From: ${new Date(cert.valid_from).toISOString().split('T')[0]}\n`;
          formatted += `├─ Valid To: ${new Date(cert.valid_to).toISOString().split('T')[0]}\n`;

          // Check if certificate is expired
          const now = new Date();
          const validTo = new Date(cert.valid_to);
          const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            formatted += `├─ Status: ❌ EXPIRED (${Math.abs(daysUntilExpiry)} days ago)\n`;
          } else if (daysUntilExpiry < 30) {
            formatted += `├─ Status: ⚠️ EXPIRING SOON (${daysUntilExpiry} days)\n`;
          } else {
            formatted += `├─ Status: ✅ VALID (${daysUntilExpiry} days remaining)\n`;
          }

          // Alternative names (SAN)
          if (cert.subjectaltname) {
            const altNames = cert.subjectaltname
              .split(', ')
              .map((name: string) => name.replace('DNS:', ''))
              .slice(0, 5); // Limit to first 5 for readability
            formatted += `├─ Alt Names: ${altNames.join(', ')}\n`;
            if (cert.subjectaltname.split(', ').length > 5) {
              formatted += `├─ ... and ${cert.subjectaltname.split(', ').length - 5} more\n`;
            }
          }

          // Serial number and fingerprint
          if (cert.serialNumber) {
            formatted += `├─ Serial: ${cert.serialNumber.substring(0, 20)}...\n`;
          }

        } else {
          formatted += `├─ Certificate: ❌ Not found or invalid\n`;
        }

      } catch (sslError: any) {
        formatted += `├─ Certificate: ❌ Unable to retrieve\n`;
        formatted += `├─ Error: ${sslError.message}\n`;

        // Try to determine if SSL is available at all
        try {
          const response = await fetch(`https://${domain}`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          formatted += `├─ HTTPS Available: ✅ (Status: ${response.status})\n`;
        } catch (httpsError) {
          formatted += `├─ HTTPS Available: ❌\n`;
        }
      }

      formatted += `╰─ SSL analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('SSL analysis error:', error);
      res.status(500).json({ error: 'SSL analysis failed' });
    }
  });

  // Reverse IP Lookup endpoint
  app.get('/api/osint/reverse-ip/:ip', async (req, res) => {
    try {
      const { ip } = req.params;

      // Validate IP format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      let formatted = `╭─ Reverse IP Lookup for ${ip}\n`;

      try {
        // Perform reverse DNS lookup to get hostnames
        const hostnames = await dns.reverse(ip);

        if (hostnames && hostnames.length > 0) {
          formatted += `├─ Found ${hostnames.length} hostname(s):\n`;

          const uniqueHostnames = Array.from(new Set(hostnames));
          uniqueHostnames.forEach((hostname, index) => {
            const prefix = index === uniqueHostnames.length - 1 ? '╰─' : '├─';
            formatted += `${prefix} ${hostname}\n`;
          });

          // Try to extract domain patterns to find related domains
          const domains = uniqueHostnames
            .map(hostname => {
              const parts = hostname.split('.');
              if (parts.length >= 2) {
                return parts.slice(-2).join('.');
              }
              return hostname;
            })
            .filter((domain, index, arr) => arr.indexOf(domain) === index);

          if (domains.length > 1) {
            formatted += `├─ Related domains detected: ${domains.slice(0, 5).join(', ')}`;
            if (domains.length > 5) {
              formatted += ` and ${domains.length - 5} more`;
            }
            formatted += '\n';
          }

        } else {
          formatted += `├─ No hostnames found for this IP\n`;
          formatted += `├─ IP may not have reverse DNS configured\n`;
        }
      } catch (reverseError) {
        formatted += `├─ Reverse DNS lookup failed\n`;
        formatted += `├─ IP may not have PTR records configured\n`;
      }

      formatted += `╰─ Reverse IP analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Reverse IP lookup error:', error);
      res.status(500).json({ error: 'Reverse IP lookup failed' });
    }
  });

  // Port Scanning endpoint
  app.get('/api/osint/portscan/:target', async (req, res) => {
    try {
      const { target } = req.params;

      // Validate target format (IP or domain)
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!ipRegex.test(target) && !domainRegex.test(target)) {
        return res.status(400).json({ error: 'Invalid IP address or domain format' });
      }

      let formatted = `╭─ Port Scan for ${target}\n`;

      // Common ports to scan (using imported net module)
      const commonPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 993, 995, 1723, 3389, 5432, 3306];
      const openPorts: number[] = [];

      formatted += `├─ Scanning ${commonPorts.length} common ports...\n`;

      // Scan ports concurrently but with limited concurrency
      const maxConcurrent = 10;
      for (let i = 0; i < commonPorts.length; i += maxConcurrent) {
        const batch = commonPorts.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(port => {
          return new Promise<number | null>((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
              socket.destroy();
              resolve(null);
            }, 2000); // 2 second timeout per port

            socket.on('connect', () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(port);
            });

            socket.on('error', () => {
              clearTimeout(timeout);
              resolve(null);
            });

            try {
              socket.connect(port, target);
            } catch (error) {
              clearTimeout(timeout);
              resolve(null);
            }
          });
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(port => {
          if (port !== null) {
            openPorts.push(port);
          }
        });

        // Small delay between batches to be respectful
        if (i + maxConcurrent < commonPorts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (openPorts.length > 0) {
        formatted += `├─ Found ${openPorts.length} open ports:\n`;

        const portServices: { [key: number]: string } = {
          21: 'FTP',
          22: 'SSH',
          23: 'Telnet',
          25: 'SMTP',
          53: 'DNS',
          80: 'HTTP',
          110: 'POP3',
          135: 'RPC',
          139: 'NetBIOS',
          143: 'IMAP',
          443: 'HTTPS',
          993: 'IMAPS',
          995: 'POP3S',
          1723: 'PPTP',
          3389: 'RDP',
          5432: 'PostgreSQL',
          3306: 'MySQL'
        };

        openPorts.forEach((port, index) => {
          const service = portServices[port] || 'Unknown';
          const prefix = index === openPorts.length - 1 ? '╰─' : '├─';
          formatted += `${prefix} Port ${port}/tcp (${service})\n`;
        });
      } else {
        formatted += `├─ No open ports found in common port range\n`;
        formatted += `├─ Target may have firewall protection or be offline\n`;
      }

      formatted += `╰─ Port scan complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Port scan error:', error);
      res.status(500).json({ error: 'Port scan failed' });
    }
  });

  // Technology Stack Detection endpoint
  app.get('/api/osint/tech/:domain', async (req, res) => {
    try {
      const { domain } = req.params;

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      let formatted = `╭─ Technology Stack Analysis for ${domain}\n`;

      try {
        const url = `https://${domain}`;
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'ARCHIMEDES-TechScan/1.0'
          }
        });

        const headers = response.headers;
        const html = await response.text();

        const technologies: string[] = [];

        // Analyze HTTP headers
        const server = headers.get('server');
        if (server) {
          technologies.push(`Server: ${server}`);
        }

        const poweredBy = headers.get('x-powered-by');
        if (poweredBy) {
          technologies.push(`Powered By: ${poweredBy}`);
        }

        // Analyze HTML content for common technologies
        const htmlLower = html.toLowerCase();

        // Frameworks and Libraries
        if (htmlLower.includes('react') || html.includes('_jsx') || html.includes('React.')) {
          technologies.push('Frontend: React');
        }
        if (htmlLower.includes('vue.js') || htmlLower.includes('vue/dist')) {
          technologies.push('Frontend: Vue.js');
        }
        if (htmlLower.includes('angular') || htmlLower.includes('ng-')) {
          technologies.push('Frontend: Angular');
        }
        if (htmlLower.includes('jquery')) {
          technologies.push('Library: jQuery');
        }
        if (htmlLower.includes('bootstrap')) {
          technologies.push('CSS Framework: Bootstrap');
        }
        if (htmlLower.includes('tailwind')) {
          technologies.push('CSS Framework: Tailwind');
        }

        // CMS Detection
        if (htmlLower.includes('wp-content') || htmlLower.includes('wordpress')) {
          technologies.push('CMS: WordPress');
        }
        if (htmlLower.includes('drupal')) {
          technologies.push('CMS: Drupal');
        }
        if (htmlLower.includes('/ghost/')) {
          technologies.push('CMS: Ghost');
        }

        // E-commerce
        if (htmlLower.includes('shopify')) {
          technologies.push('E-commerce: Shopify');
        }
        if (htmlLower.includes('woocommerce')) {
          technologies.push('E-commerce: WooCommerce');
        }

        // Analytics and Tracking
        if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag')) {
          technologies.push('Analytics: Google Analytics');
        }
        if (htmlLower.includes('gtm.js') || htmlLower.includes('googletagmanager')) {
          technologies.push('Tag Manager: Google Tag Manager');
        }

        // CDN Detection
        if (headers.get('cf-ray') || headers.get('cf-cache-status')) {
          technologies.push('CDN: Cloudflare');
        }
        if (headers.get('x-amz-cf-id')) {
          technologies.push('CDN: AWS CloudFront');
        }

        formatted += `├─ Response Status: ${response.status} ${response.statusText}\n`;

        if (technologies.length > 0) {
          formatted += `├─ Detected Technologies:\n`;
          technologies.forEach((tech, index) => {
            const prefix = index === technologies.length - 1 ? '│  ╰─' : '│  ├─';
            formatted += `${prefix} ${tech}\n`;
          });
        } else {
          formatted += `├─ No obvious technologies detected\n`;
        }

        // Check for common security headers
        const securityHeaders = [
          'strict-transport-security',
          'x-frame-options',
          'x-content-type-options',
          'content-security-policy'
        ];

        const presentHeaders = securityHeaders.filter(header => headers.get(header));
        if (presentHeaders.length > 0) {
          formatted += `├─ Security Headers: ${presentHeaders.length}/${securityHeaders.length} present\n`;
        }

      } catch (techError: any) {
        formatted += `├─ Unable to analyze: ${techError.message}\n`;
      }

      formatted += `╰─ Technology analysis complete`;
      res.json({ formatted });

    } catch (error) {
      console.error('Technology analysis error:', error);
      res.status(500).json({ error: 'Technology analysis failed' });
    }
  });

  // Comprehensive OSINT Report endpoint
  app.get('/api/osint/report/:target', async (req, res) => {
    try {
      const { target } = req.params;

      // Determine if target is IP or domain
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const isIP = ipRegex.test(target);

      let formatted = `╭─ Comprehensive OSINT Report for ${target}\n`;
      formatted += `├─ Target Type: ${isIP ? 'IP Address' : 'Domain'}\n`;
      formatted += `├─ Report Generated: ${new Date().toISOString()}\n`;
      formatted += `├─ Gathering intelligence from multiple sources...\n`;
      formatted += `│\n`;

      const results: { [key: string]: any } = {};

      // For domains, gather comprehensive intelligence
      if (!isIP) {
        // WHOIS Lookup
        try {
          const whoisRes = await fetch(`http://localhost:5000/api/osint/whois/${target}`);
          const whoisData = await whoisRes.json();
          results.whois = whoisData;
        } catch (e) {
          results.whois = { error: 'WHOIS lookup failed' };
        }

        // DNS Records
        try {
          const dnsRes = await fetch(`http://localhost:5000/api/osint/dns/${target}`);
          const dnsData = await dnsRes.json();
          results.dns = dnsData;
        } catch (e) {
          results.dns = { error: 'DNS lookup failed' };
        }

        // SSL Certificate
        try {
          const sslRes = await fetch(`http://localhost:5000/api/osint/ssl/${target}`);
          const sslData = await sslRes.json();
          results.ssl = sslData;
        } catch (e) {
          results.ssl = { error: 'SSL analysis failed' };
        }

        // Technology Stack
        try {
          const techRes = await fetch(`http://localhost:5000/api/osint/tech/${target}`);
          const techData = await techRes.json();
          results.tech = techData;
        } catch (e) {
          results.tech = { error: 'Technology analysis failed' };
        }

        // Subdomain Enumeration (limited for report)
        try {
          const subdomainsRes = await fetch(`http://localhost:5000/api/osint/subdomains/${target}`);
          const subdomainsData = await subdomainsRes.json();
          results.subdomains = subdomainsData;
        } catch (e) {
          results.subdomains = { error: 'Subdomain enumeration failed' };
        }
      }

      // For both IPs and domains, resolve to IP if needed
      let resolvedIP = target;      if (!isIP) {
        try {
          const addresses = await dns.resolve4(target);
          resolvedIP = addresses[0];
          results.resolvedIP = resolvedIP;
        } catch (e) {
          results.resolvedIP = null;
        }
      }

      // GeoIP for the resolved IP
      if (resolvedIP) {
        try {
          const geoipRes = await fetch(`http://localhost:5000/api/osint/geoip/${resolvedIP}`);
          const geoipData = await geoipRes.json();
          results.geoip = geoipData;
        } catch (e) {
          results.geoip = { error: 'GeoIP lookup failed' };
        }

        // Reverse IP if we have an IP
        try {
          const reverseRes = await fetch(`http://localhost:5000/api/osint/reverse-ip/${resolvedIP}`);
          const reverseData = await reverseRes.json();
          results.reverse = reverseData;
        } catch (e) {
          results.reverse = { error: 'Reverse IP lookup failed' };
        }
      }

      // Format comprehensive report
      formatted += `├─ DOMAIN INTELLIGENCE:\n`;
      if (results.whois && !results.whois.error) {
        const whoisLines = results.whois.formatted.split('\n').slice(1, 4);
        whoisLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      if (results.dns && !results.dns.error) {
        formatted += `│  DNS: Multiple record types detected\n`;
      }

      if (results.ssl && !results.ssl.error) {
        const sslLines = results.ssl.formatted.split('\n').slice(1, 3);
        sslLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      formatted += `│\n`;
      formatted += `├─ INFRASTRUCTURE ANALYSIS:\n`;

      if (results.geoip && !results.geoip.error) {
        const geoLines = results.geoip.formatted.split('\n').slice(1, 4);
        geoLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      }

      if (results.reverse && !results.reverse.error) {
        formatted += `│  Multiple domains may share this infrastructure\n`;
      }

      formatted += `│\n`;
      formatted += `├─ TECHNOLOGY STACK:\n`;
      if (results.tech && !results.tech.error) {
        const techLines = results.tech.formatted.split('\n').slice(2, 6);
        techLines.forEach((line: string) => {
          if (line.trim()) formatted += `│  ${line}\n`;
        });
      } else {
        formatted += `│  Technology analysis unavailable\n`;
      }

      formatted += `│\n`;
      formatted += `├─ ATTACK SURFACE:\n`;
      if (results.subdomains && !results.subdomains.error) {
        const subdomainCount = (results.subdomains.formatted.match(/Found (\d+) active/)?.[1]) || 'Unknown';
        formatted += `│  Subdomains discovered: ${subdomainCount}\n`;
      }
      formatted += `│  Recommend: Port scan, directory enumeration\n`;

      formatted += `│\n`;
      formatted += `├─ RECOMMENDATIONS:\n`;
      formatted += `│  • Run detailed port scan: portscan ${resolvedIP || target}\n`;
      formatted += `│  • Check HTTP headers: headers https://$\{target}\n`;
      formatted += `│  • Search historical data: wayback https://$\{target}\n`;
      formatted += `│  • Verify username patterns: username ${target.split('.')[0]}\n`;
      formatted += `│\n`;
      formatted += `╰─ Comprehensive OSINT report complete`;

      res.json({ formatted, data: results });

    } catch (error) {
      console.error('OSINT report error:', error);
      res.status(500).json({ error: 'OSINT report generation failed' });
    }
  });

  // MISP Galaxy Threat Actors endpoint
  app.get('/api/osint/threat-actors', async (req, res) => {
    try {
      console.log('🎯 Fetching MISP Galaxy threat actors...');

      const response = await fetch('https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json', {
        signal: AbortSignal.timeout(10000),        headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
      });

      if (!response.ok) {
        throw new Error(`GitHub fetch failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.values || !Array.isArray(data.values)) {
        throw new Error('Invalid MISP Galaxy data format');
      }

      // Format the threat actor data for terminal display
      let formatted = `╭─ MISP Galaxy Threat Actors Intelligence\n`;
      formatted += `├─ Source: ${data.source || 'MISP Project'}\n`;
      formatted += `├─ Type: ${data.type}\n`;
      formatted += `├─ Total Actors: ${data.values.length}\n`;
      formatted += `├─ Last Updated: ${new Date().toISOString().split('T')[0]}\n`;
      formatted += `├─\n`;
      formatted += `├─ Top 20 Current Threat Actors:\n`;
      formatted += `├─\n`;

      // Sort by attribution confidence and take top 20
      const sortedActors = data.values
        .filter((actor: any) => actor.value && actor.description)
        .sort((a: any, b: any) => {
          const aConfidence = parseInt(a.meta?.['attribution-confidence'] || '0');
          const bConfidence = parseInt(b.meta?.['attribution-confidence'] || '0');
          return bConfidence - aConfidence;
        })
        .slice(0, 20);

      sortedActors.forEach((actor: any, index: number) => {
        const confidence = actor.meta?.['attribution-confidence'] || 'Unknown';
        const country = actor.meta?.country || 'Unknown';
        const synonyms = actor.meta?.synonyms?.slice(0, 3)?.join(', ') || 'None';
        const description = actor.description.length > 100
          ? actor.description.substring(0, 97) + '...'
          : actor.description;

        formatted += `├─ ${index + 1}. ${actor.value}\n`;
        formatted += `│  ├─ Country: ${country}\n`;
        formatted += `│  ├─ Confidence: ${confidence}%\n`;
        formatted += `│  ├─ Aliases: ${synonyms}\n`;
        formatted += `│  ├─ Description: ${description}\n`;
        if (actor.meta?.refs && actor.meta.refs.length > 0) {
          formatted += `│  └─ References: ${actor.meta.refs.slice(0, 2).join(', ')}\n`;
        }
        formatted += `├─\n`;
      });

      formatted += `└─ Use 'threat-actors <name>' for detailed actor information\n`;

      res.json({
        formatted,
        count: data.values.length,
        source: 'MISP Galaxy',
        type: 'threat-actors'
      });

    } catch (error) {
      console.error('❌ Threat actors fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch threat actor intelligence',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // MISP Galaxy specific threat actor lookup
  app.get('/api/osint/threat-actors/:name', async (req, res) => {
    try {
      const { name } = req.params;
      console.log(`🎯 Looking up threat actor: ${name}`);

      const response = await fetch('https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json', {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
      });

      if (!response.ok) {
        throw new Error(`GitHub fetch failed: ${response.status}`);
      }

      const data = await response.json();

      // Search for the specific threat actor
      const actor = data.values.find((actor: any) =>
        actor.value.toLowerCase().includes(name.toLowerCase()) ||
        actor.meta?.synonyms?.some((synonym: string) =>
          synonym.toLowerCase().includes(name.toLowerCase())
        )
      );

      if (!actor) {
        return res.status(404).json({
          error: `Threat actor '${name}' not found in MISP Galaxy database`,
          suggestion: 'Try using partial names or known aliases'
        });
      }

      // Format detailed actor information
      let formatted = `╭─ Threat Actor: ${actor.value}\n`;
      formatted += `├─ UUID: ${actor.uuid}\n`;
      formatted += `├─\n`;
      formatted += `├─ Description:\n`;
      formatted += `├─ ${actor.description}\n`;
      formatted += `├─\n`;

      if (actor.meta) {
        const meta = actor.meta;

        if (meta.country) {
          formatted += `├─ Country/Origin: ${meta.country}\n`;
        }

        if (meta['attribution-confidence']) {
          formatted += `├─ Attribution Confidence: ${meta['attribution-confidence']}\%\n`;
        }

        if (meta['cfr-suspected-state-sponsor']) {
          formatted += `├─ Suspected State Sponsor: ${meta['cfr-suspected-state-sponsor']}\n`;
        }

        if (meta['cfr-suspected-victims']) {
          formatted += `├─ Known Victims: ${meta['cfr-suspected-victims'].slice(0, 5).join(', ')}\n`;
          if (meta['cfr-suspected-victims'].length > 5) {
            formatted += `├─   (and ${meta['cfr-suspected-victims'].length - 5} more)\n`;
          }
        }

        if (meta['cfr-target-category']) {
          formatted += `├─ Target Categories: ${meta['cfr-target-category'].join(', ')}\n`;
        }

        if (meta['cfr-type-of-incident']) {
          formatted += `├─ Incident Type: ${meta['cfr-type-of-incident']}\n`;
        }

        if (meta.synonyms) {
          formatted += `├─\n├─ Known Aliases: ${meta.synonyms.join(', ')}\n`;
        }

        if (meta.refs) {
          formatted += `├─\n├─ References:\n`;
          meta.refs.slice(0, 8).forEach((ref: string, index: number) => {
            formatted += `├─ ${index + 1}. ${ref}\n`;
          });
          if (meta.refs.length > 8) {
            formatted += `├─   (and ${meta.refs.length - 8} more references)\n`;
          }
        }
      }

      formatted += `└─ Intelligence sourced from MISP Galaxy\n`;

      res.json({
        formatted,
        actor: actor.value,
        source: 'MISP Galaxy'
      });

    } catch (error) {
      console.error('❌ Threat actor lookup error:', error);
      res.status(500).json({
        error: 'Failed to lookup threat actor',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // SpiderFoot API endpoint
  app.post("/api/spiderfoot", async (req, res) => {
    try {
      // Validate request body using Zod
      const spiderFootSchema = z.object({
        target: z.string().min(1, 'Target is required'),
        scanType: z.string().default('footprint')
      });

      const validationResult = spiderFootSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const { target, scanType } = validationResult.data;
      const cleanTarget = target.toLowerCase().trim();

      // Generate mock SpiderFoot results
      const generateFindings = (type: string, count: number) => {
        const findings = [];
        const confidenceLevels = ['High', 'Medium', 'Low'];

        for (let i = 0; i < count; i++) {
          findings.push({
            type: type,
            data: `${type}_data_${i}_for_${cleanTarget}`,
            source: `Module_${type.replace(/\s/g, '_')}`,
            confidence: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)]
          });
        }
        return findings;
      };

      const mockResults = {
        modules: {
          'DNS Records': { findings: generateFindings('DNS A Record', 3) },
          'WHOIS Data': { findings: generateFindings('WHOIS Information', 2) },
          'SSL Certificate': { findings: generateFindings('SSL/TLS Certificate', 2) },
          'Email Addresses': { findings: generateFindings('Email Address', 5) },
          'Social Media': { findings: generateFindings('Social Media Profile', 4) },
          'Breach Data': { findings: generateFindings('Data Breach Record', 1) },
          'Vulnerabilities': { findings: generateFindings('CVE', 2) },
          'Subdomains': { findings: generateFindings('Subdomain', 8) },
          'IP Intelligence': { findings: generateFindings('IP Geolocation', 2) }
        },
        summary: {
          total_findings: 0,
          high_confidence: 0,
          medium_confidence: 0,
          low_confidence: 0
        },
        metadata: {
          target: cleanTarget,
          scan_type: scanType,
          timestamp: new Date().toISOString(),
          modules_used: Object.keys({
            'DNS Records': true,
            'WHOIS Data': true,
            'SSL Certificate': true,
            'Email Addresses': true,
            'Social Media': true,
            'Breach Data': true,
            'Vulnerabilities': true,
            'Subdomains': true,
            'IP Intelligence': true
          })
        }
      };

      // Calculate summary statistics
      let totalFindings = 0;
      let highConfidence = 0;
      let mediumConfidence = 0;
      let lowConfidence = 0;

      Object.values(mockResults.modules).forEach(module => {
        module.findings.forEach(finding => {
          totalFindings++;
          if (finding.confidence === 'High') highConfidence++;
          else if (finding.confidence === 'Medium') mediumConfidence++;
          else lowConfidence++;
        });
      });

      mockResults.summary = {
        total_findings: totalFindings,
        high_confidence: highConfidence,
        medium_confidence: mediumConfidence,
        low_confidence: lowConfidence
      };

      res.json(mockResults);
    } catch (error) {
      console.error('SpiderFoot error:', error);
      res.status(500).json({
        error: 'OSINT scan failed',
        modules: {},
        summary: {
          total_findings: 0,
          high_confidence: 0,
          medium_confidence: 0,
          low_confidence: 0
        },
        metadata: {
          target: req.body.target || 'unknown',
          scan_type: req.body.scanType || 'footprint',
          timestamp: new Date().toISOString(),
          modules_used: []
        }
      });
    }
  });

  // Wolfram Alpha query endpoint
  app.get('/api/wolfram/query', async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const { queryWolfram } = await import('./wolfram-service');
      const result = await queryWolfram(query);

      res.json(result);
    } catch (error) {
      console.error('Wolfram Alpha query error:', error);
      res.status(500).json({
        error: 'Failed to query Wolfram Alpha',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}