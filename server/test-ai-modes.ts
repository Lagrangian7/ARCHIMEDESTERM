
import { LLMService } from './llm-service';

const llmService = LLMService.getInstance();

interface TestResult {
  mode: string;
  test: string;
  success: boolean;
  response?: string;
  error?: string;
  duration: number;
}

const testCases = {
  natural: [
    "What is recursion in programming?",
    "Tell me about quantum computing",
    "Explain the concept of machine learning"
  ],
  technical: [
    "How do I build a wooden bookshelf?",
    "What are the steps to install a ceiling fan?",
    "How do I wire a three-way light switch?"
  ],
  freestyle: [
    "Write a Python function to calculate fibonacci numbers",
    "Create a JavaScript function to sort an array",
    "Write a React component for a todo list"
  ],
  health: [
    "What are the benefits of vitamin D?",
    "Natural remedies for headaches",
    "How does turmeric help with inflammation?"
  ]
};

async function testMode(mode: 'natural' | 'technical' | 'freestyle' | 'health', query: string): Promise<TestResult> {
  const startTime = Date.now();
  const testResult: TestResult = {
    mode,
    test: query,
    success: false,
    duration: 0
  };

  try {
    console.log(`\n🧪 Testing ${mode.toUpperCase()} mode: "${query}"`);
    
    const response = await llmService.generateResponse(
      query,
      mode,
      [],
      undefined,
      'english',
      false
    );

    const duration = Date.now() - startTime;
    
    if (response && response.length > 0) {
      testResult.success = true;
      testResult.response = response.substring(0, 200) + '...';
      testResult.duration = duration;
      console.log(`✅ SUCCESS (${duration}ms)`);
      console.log(`Response preview: ${testResult.response}`);
    } else {
      testResult.error = 'Empty response';
      testResult.duration = duration;
      console.log(`❌ FAILED: Empty response`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    testResult.error = error instanceof Error ? error.message : 'Unknown error';
    testResult.duration = duration;
    console.log(`❌ FAILED (${duration}ms): ${testResult.error}`);
  }

  return testResult;
}

async function runAllTests() {
  console.log('🚀 Starting AI Mode Functionality Tests\n');
  console.log('=' .repeat(60));
  
  const allResults: TestResult[] = [];

  // Test Natural Mode
  console.log('\n📘 NATURAL MODE TESTS');
  console.log('-'.repeat(60));
  for (const query of testCases.natural) {
    const result = await testMode('natural', query);
    allResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit protection
  }

  // Test Technical Mode
  console.log('\n🔧 TECHNICAL MODE TESTS');
  console.log('-'.repeat(60));
  for (const query of testCases.technical) {
    const result = await testMode('technical', query);
    allResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test Freestyle Mode
  console.log('\n🎨 FREESTYLE MODE TESTS');
  console.log('-'.repeat(60));
  for (const query of testCases.freestyle) {
    const result = await testMode('freestyle', query);
    allResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test Health Mode
  console.log('\n🌿 HEALTH MODE TESTS');
  console.log('-'.repeat(60));
  for (const query of testCases.health) {
    const result = await testMode('health', query);
    allResults.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary Report
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const summary = {
    total: allResults.length,
    passed: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    avgDuration: Math.round(allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length)
  };

  console.log(`\nTotal Tests: ${summary.total}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⏱️  Average Response Time: ${summary.avgDuration}ms`);

  // Mode-specific breakdown
  console.log('\n📈 Results by Mode:');
  ['natural', 'technical', 'freestyle', 'health'].forEach(mode => {
    const modeResults = allResults.filter(r => r.mode === mode);
    const passed = modeResults.filter(r => r.success).length;
    const total = modeResults.length;
    console.log(`  ${mode.toUpperCase()}: ${passed}/${total} passed`);
  });

  // Failed tests details
  const failedTests = allResults.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n⚠️  Failed Tests Details:');
    failedTests.forEach(test => {
      console.log(`  - [${test.mode}] ${test.test}`);
      console.log(`    Error: ${test.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test run complete!\n');

  return {
    summary,
    results: allResults
  };
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { runAllTests, testMode };
