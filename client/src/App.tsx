import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechProvider } from "@/contexts/SpeechContext";
import { SplashScreen } from "@/components/SplashScreen";
import TerminalPage from "@/pages/terminal";

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
  const [showSplash, setShowSplash] = useState(true);

  // Apply saved theme immediately on app mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'theme-green';
    console.log('App mounting - applying theme:', savedTheme);
    document.documentElement.classList.add(savedTheme);
  }, []);


  useEffect(() => {
    // Check if splash has been shown in this session
    const splashShown = sessionStorage.getItem('splashShown');
    if (splashShown) {
      setShowSplash(false);
    } else {
      // Auto-dismiss splash after 3 seconds if user doesn't interact
      const timeout = setTimeout(() => {
        handleSplashComplete();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SpeechProvider>
          <Toaster />
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <Router />
        </SpeechProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;