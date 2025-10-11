import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Complete and unmount after 3 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="splash-screen"
    >
      <div className="relative animate-pulse">
        <img
          src="/splash-logo.png"
          alt="ARCHIMEDES v7 AI Terminal"
          className="w-96 h-96 object-contain"
          style={{
            filter: 'drop-shadow(0 0 30px rgba(0, 255, 65, 0.5))',
            animation: 'glow 2s ease-in-out infinite'
          }}
        />
      </div>
      
      <style>{`
        @keyframes glow {
          0%, 100% {
            filter: drop-shadow(0 0 20px rgba(0, 255, 65, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(0, 255, 65, 0.8));
          }
        }
      `}</style>
    </div>
  );
}
