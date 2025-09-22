import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, isSpeaking, currentMessage }: TalkingArchimedesProps) {
  const shouldShow = isTyping || isSpeaking;

  return (
    <div className={`fixed top-4 right-4 z-40 pointer-events-none transition-all duration-300 ${
      shouldShow ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
    }`}>
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm">
        <video 
          src={archimedesVideo2}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export default TalkingArchimedes;