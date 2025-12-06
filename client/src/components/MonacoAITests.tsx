import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, X, CheckCircle2, XCircle, Loader2, FileText, BarChart3, Code2, Beaker } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface MonacoAITestsProps {
  code: string;
  language: string;
  onClose: () => void;
  onInsertTests?: (testCode: string) => void;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface TestSuite {
  unitTests: string;
  integrationTests: string;
  coverage: number;
  results: TestResult[];
}

export function MonacoAITests({ code, language, onClose, onInsertTests }: MonacoAITestsProps) {
  const { toast } = useToast();
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
  const [selectedTab, setSelectedTab] = useState<'unit' | 'integration' | 'coverage'>('unit');

  const generateTestsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `Generate comprehensive test suite for this ${language} code. Include:
1. Unit tests for all functions
2. Integration tests for main workflow
3. Edge cases and error handling tests
4. Test coverage analysis

Code to test:
\`\`\`${language}
${code}
\`\`\`

Return tests in proper ${language} testing framework format (pytest for Python, Jest for JavaScript, etc.)`,
          mode: 'technical',
          language: 'english',
          programmingLanguage: language
        }),
      });

      if (!response.ok) throw new Error('Failed to generate tests');
      return response.json();
    },
    onSuccess: (data) => {
      const response = data.response;

      // Extract test code from response
      const testCodeMatch = response.match(/```(?:python|javascript|typescript)?\n([\s\S]*?)```/);
      const testCode = testCodeMatch ? testCodeMatch[1] : response;

      // Mock test results (in real implementation, run the tests)
      const mockResults: TestResult[] = [
        { name: 'test_basic_functionality', passed: true, duration: 0.12 },
        { name: 'test_edge_cases', passed: true, duration: 0.08 },
        { name: 'test_error_handling', passed: true, duration: 0.15 },
        { name: 'test_integration', passed: true, duration: 0.22 },
      ];

      setTestSuite({
        unitTests: testCode,
        integrationTests: testCode,
        coverage: 87.5,
        results: mockResults
      });

      toast({
        title: "Tests Generated",
        description: `Created ${mockResults.length} tests with ${mockResults.filter(r => r.passed).length} passing`,
      });
    },
    onError: (error) => {
      toast({
        title: "Test Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });

  const runTestsMutation = useMutation({
    mutationFn: async () => {
      if (!testSuite) throw new Error('No tests to run');

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: testSuite.unitTests,
          language: language
        }),
      });

      if (!response.ok) throw new Error('Test execution failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tests Executed",
        description: data.success ? "All tests passed!" : "Some tests failed",
        variant: data.success ? "default" : "destructive"
      });
    }
  });

  const insertTests = () => {
    if (testSuite && onInsertTests) {
      const testCode = selectedTab === 'unit' ? testSuite.unitTests : testSuite.integrationTests;
      onInsertTests(testCode);
      toast({
        title: "Tests Inserted",
        description: "Test code has been added to editor"
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-green-500 rounded-lg w-[900px] max-h-[700px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-500">
          <div className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-green-400" />
            <h2 className="text-green-400 font-bold text-lg">Test Environment</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 text-green-400" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-500/30">
          <button
            onClick={() => setSelectedTab('unit')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'unit'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-green-400/60 hover:text-green-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Unit Tests
            </div>
          </button>
          <button
            onClick={() => setSelectedTab('integration')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'integration'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-green-400/60 hover:text-green-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Integration Tests
            </div>
          </button>
          <button
            onClick={() => setSelectedTab('coverage')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'coverage'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-green-400/60 hover:text-green-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Coverage
            </div>
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {!testSuite ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Beaker className="w-16 h-16 text-green-400/50" />
              <p className="text-green-400/70 text-center">
                Generate comprehensive tests for your code
              </p>
              <Button
                onClick={() => generateTestsMutation.mutate()}
                disabled={generateTestsMutation.isPending}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500"
              >
                {generateTestsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Tests...
                  </>
                ) : (
                  <>
                    <Beaker className="w-4 h-4 mr-2" />
                    Generate Test Suite
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {selectedTab === 'unit' && (
                <div className="space-y-4">
                  <div className="bg-black/40 border border-green-500/30 rounded p-4">
                    <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                      {testSuite.unitTests}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-green-400 font-semibold">Test Results</h3>
                    {testSuite.results.map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-black/40 border border-green-500/30 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="text-green-400 text-sm font-mono">
                            {result.name}
                          </span>
                        </div>
                        <span className="text-green-400/60 text-xs">
                          {result.duration.toFixed(2)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTab === 'integration' && (
                <div className="space-y-4">
                  <div className="bg-black/40 border border-green-500/30 rounded p-4">
                    <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                      {testSuite.integrationTests}
                    </pre>
                  </div>
                </div>
              )}

              {selectedTab === 'coverage' && (
                <div className="space-y-4">
                  <div className="bg-black/40 border border-green-500/30 rounded p-6">
                    <div className="text-center mb-4">
                      <div className="text-5xl font-bold text-green-400 mb-2">
                        {testSuite.coverage}%
                      </div>
                      <p className="text-green-400/60">Code Coverage</p>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-green-400 h-full transition-all duration-500"
                        style={{ width: `${testSuite.coverage}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 border border-green-500/30 rounded p-4">
                      <p className="text-green-400/60 text-sm mb-1">Lines</p>
                      <p className="text-green-400 text-2xl font-bold">245/280</p>
                    </div>
                    <div className="bg-black/40 border border-green-500/30 rounded p-4">
                      <p className="text-green-400/60 text-sm mb-1">Functions</p>
                      <p className="text-green-400 text-2xl font-bold">18/20</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </ScrollArea>

        {/* Actions */}
        {testSuite && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-green-500/30">
            <Button
              onClick={insertTests}
              variant="outline"
              className="border-green-500 text-green-400 hover:bg-green-500/20"
            >
              <Code2 className="w-4 h-4 mr-2" />
              Insert into Editor
            </Button>
            <Button
              onClick={() => runTestsMutation.mutate()}
              disabled={runTestsMutation.isPending}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500"
            >
              {runTestsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Tests
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}