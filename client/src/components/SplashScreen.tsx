import { useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  const handleInteraction = () => {
    setFadeOut(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black transition-opacity duration-500 cursor-pointer ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      data-testid="splash-screen"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <h1 
          className="text-8xl font-bold text-red-600 animate-pulse opacity-70 text-center"
          style={{
            textShadow: '0 0 30px rgba(255, 0, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5)',
            fontFamily: 'monospace'
          }}
        >
          アルキメデス v7!
        </h1>
      </div>
      <p className="absolute bottom-8 left-0 right-0 text-center text-white text-xl animate-bounce opacity-60">
        Click or tap to continue
      </p>
    </div>
  );
}
