import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechProvider } from "@/contexts/SpeechContext";
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SpeechProvider>
          <Toaster />
          <Router />
        </SpeechProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
