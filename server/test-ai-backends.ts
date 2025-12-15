import OpenAI from 'openai';
import { HfInference } from '@huggingface/inference';
import { Mistral } from '@mistralai/mistralai';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('=== AI Backend Test ===\n');

// Test environment variables
const envVars = {
  'GROQ_API_KEY': !!process.env.GROQ_API_KEY,
  'MISTRAL_API_KEY': !!process.env.MISTRAL_API_KEY,
  'OPENAI_API_KEY': !!process.env.OPENAI_API_KEY,
  'HUGGINGFACE_API_KEY': !!process.env.HUGGINGFACE_API_KEY,
  'GEMINI_API_KEY': !!process.env.GEMINI_API_KEY,
  'GOOGLE_API_KEY': !!process.env.GOOGLE_API_KEY,
  'REPLIT_AI_API_KEY': !!process.env.REPLIT_AI_API_KEY,
};

console.log('Environment Variables:');
for (const [key, exists] of Object.entries(envVars)) {
  console.log(`  ${key}: ${exists ? '✓ SET' : '✗ MISSING'}`);
}
console.log('');

async function testGroq() {
  if (!process.env.GROQ_API_KEY) {
    return { status: 'SKIP', error: 'No GROQ_API_KEY' };
  }
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 20,
    });
    return { status: 'OK', response: response.choices[0]?.message?.content?.slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function testGemini() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    return { status: 'SKIP', error: 'No GEMINI_API_KEY or GOOGLE_API_KEY' };
  }
  try {
    const gemini = new GoogleGenerativeAI(key.slice(0, 39));
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Say hello');
    return { status: 'OK', response: result.response.text().slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function testOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'SKIP', error: 'No OPENAI_API_KEY' };
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 20,
    });
    return { status: 'OK', response: response.choices[0]?.message?.content?.slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function testReplitMistral() {
  try {
    const replitAI = new OpenAI({
      apiKey: process.env.REPLIT_AI_API_KEY || 'placeholder',
      baseURL: 'https://ai-inference.replit.com/v1',
    });
    const response = await replitAI.chat.completions.create({
      model: 'mistralai/mistral-7b-instruct-v0.3',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 20,
    });
    return { status: 'OK', response: response.choices[0]?.message?.content?.slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function testMistralAPI() {
  if (!process.env.MISTRAL_API_KEY) {
    return { status: 'SKIP', error: 'No MISTRAL_API_KEY' };
  }
  try {
    const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    const response = await mistral.chat.complete({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: 'Say hello' }],
      maxTokens: 20,
    });
    return { status: 'OK', response: (response.choices?.[0]?.message?.content as string)?.slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function testHuggingFace() {
  if (!process.env.HUGGINGFACE_API_KEY) {
    return { status: 'SKIP', error: 'No HUGGINGFACE_API_KEY' };
  }
  try {
    const model = 'meta-llama/Llama-3.1-8B-Instruct';
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 20,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { status: 'ERROR', error: `${response.status}: ${text.slice(0, 150)}` };
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    return { status: 'OK', response: content?.slice(0, 50) || JSON.stringify(result).slice(0, 50) };
  } catch (error: any) {
    return { status: 'ERROR', error: error.message };
  }
}

async function runAllTests() {
  console.log('Testing AI Backends...\n');
  
  const tests = [
    { name: '1. Groq (Primary)', fn: testGroq },
    { name: '2. Gemini', fn: testGemini },
    { name: '3. Replit Mistral', fn: testReplitMistral },
    { name: '4. OpenAI', fn: testOpenAI },
    { name: '5. Mistral API', fn: testMistralAPI },
    { name: '6. HuggingFace', fn: testHuggingFace },
  ];
  
  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    const result = await test.fn();
    if (result.status === 'OK') {
      console.log(`  ✓ ${result.status}: ${result.response}`);
    } else if (result.status === 'SKIP') {
      console.log(`  ⊘ ${result.status}: ${result.error}`);
    } else {
      console.log(`  ✗ ${result.status}: ${result.error}`);
    }
    console.log('');
  }
}

runAllTests().then(() => {
  console.log('=== Test Complete ===');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
