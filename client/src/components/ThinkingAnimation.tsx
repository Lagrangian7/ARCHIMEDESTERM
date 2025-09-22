import thinkingVideo from '@assets/thinking_1757974879665.mp4';

interface ThinkingAnimationProps {
  isThinking: boolean;
}

export function ThinkingAnimation({ isThinking }: ThinkingAnimationProps) {
  if (!isThinking) return null;

  return (
    <div className="fixed top-4 left-4 z-40 pointer-events-none">
      <div className="relative w-12 h-12 rounded-full overflow-hidden border border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm">
        <video 
          src={thinkingVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          data-testid="thinking-animation"
        />
      </div>
    </div>
  );
}

export default ThinkingAnimation;