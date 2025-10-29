import { Terminal } from '@/components/Terminal';
import MatrixRain from '@/components/MatrixRain';
import WebampPlayer from '@/components/WebampPlayer';
import MilkdropBackground from '@/components/MilkdropBackground';
import { useTerminal } from '@/hooks/useTerminal';

export default function TerminalPage() {
  const {
    input,
    setInput,
    output,
    handleCommand,
    clearTerminal,
    isMatrixRainEnabled,
    isWebampOpen,
    setIsWebampOpen,
    isMilkdropEnabled,
    milkdropOpacity,
    conversationHistory,
    clearConversationHistory,
  } = useTerminal();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Matrix Rain Background */}
      <MatrixRain />

      {/* MilkDrop Visualizer Background */}
      <MilkdropBackground isEnabled={isMilkdropEnabled} opacity={milkdropOpacity} />

      {/* Main Terminal Content */}
      <Terminal
        input={input}
        setInput={setInput}
        output={output}
        handleCommand={handleCommand}
        clearTerminal={clearTerminal}
        isWebampOpen={isWebampOpen}
        setIsWebampOpen={setIsWebampOpen}
        conversationHistory={conversationHistory}
        clearConversationHistory={clearConversationHistory}
      />

      {/* Webamp Player (optional) */}
      <WebampPlayer isOpen={isWebampOpen} setIsOpen={setIsWebampOpen} />
    </div>
  );
}