import { useState, useEffect, Component, ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechProvider } from "@/contexts/SpeechContext";
import { SplashScreen } from "@/components/SplashScreen";
import TerminalPage from "@/pages/terminal";

// Error boundary component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: "20px", 
          background: "#000", 
          color: "#00FF41", 
          fontFamily: "monospace",
          minHeight: "100vh"
        }}>
          <h1>⚠️ SYSTEM ERROR</h1>
          <p>Something went wrong. Please refresh the page.</p>
          <pre style={{ fontSize: "12px", marginTop: "20px" }}>
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#00FF41",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontFamily: "monospace"
            }}
          >
            RELOAD
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={TerminalPage} />
      <Route path="/terminal" component={TerminalPage} />
      <Route>
        <TerminalPage />
      </Route>
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Check if splash has been shown in this session on initial load
    return !sessionStorage.getItem('splashShown');
  });

  useEffect(() => {
    if (showSplash) {
      // Auto-dismiss splash after 3 seconds if user doesn't interact
      const timeout = setTimeout(() => {
        handleSplashComplete();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [showSplash]);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SpeechProvider>
            <Toaster />
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <Router />
          </SpeechProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
