import { useState } from 'react';
import archyLogo from '@assets/archy111_1760233943010.jpeg';

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-500 cursor-pointer ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      data-testid="splash-screen"
    >
      <img
        src={archyLogo}
        alt="ARCHIMEDES Logo"
        className="absolute inset-0 w-full h-full object-contain opacity-30"
      />
      <h1 
        className="relative text-8xl font-bold text-red-600 animate-pulse mb-8 opacity-70"
        style={{
          textShadow: '0 0 30px rgba(255, 0, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5)',
          fontFamily: 'monospace'
        }}
      >
        アルキメデス v7!
      </h1>
      <p className="relative text-white text-xl animate-bounce opacity-60">
        Click or tap to continue
      </p>
    </div>
  );
}
