import { useEffect, useRef } from 'react';
import Webamp from 'webamp/butterchurn';

interface WebampPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebampPlayer({ isOpen, onClose }: WebampPlayerProps) {
  const webampRef = useRef<Webamp | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Check if Webamp is already initialized
    if (webampRef.current) return;

    const initWebamp = async () => {
      try {
        const webamp = new Webamp({
          initialTracks: [
            {
              metaData: {
                artist: "ARCHIMEDES v7",
                title: "Lagrangian 25"
              },
              url: "/lagrangian-25.mp3",
              duration: 240
            }
          ],
          
          // Enable Milkdrop visualizer with butterchurn presets
          requireButterchurnPresets: () => import('butterchurn-presets').then(
            (module: any) => module.default.getPresets()
          ),
          
          // Initial window layout
          windowLayout: {
            main: { position: { top: 20, left: 20 } },
            equalizer: { position: { top: 20, left: 295 } },
            playlist: { 
              position: { top: 252, left: 20 },
              size: { extraHeight: 4, extraWidth: 0 } 
            },
            milkdrop: { 
              position: { top: 20, left: 570 },
              size: { extraHeight: 12, extraWidth: 7 }
            }
          },
          
          // Available skins
          availableSkins: [
            {
              url: "https://cdn.webampskins.org/skins/base-2.91.wsz",
              name: "Classic Winamp"
            }
          ]
        });

        // Handle close event
        webamp.onClose(() => {
          onClose();
        });

        // Render Webamp - null check already done above
        const container = containerRef.current;
        if (container) {
          await webamp.renderWhenReady(container);
          webampRef.current = webamp;
          console.log('Webamp initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize Webamp:', error);
      }
    };

    initWebamp();

    // Cleanup function
    return () => {
      if (webampRef.current) {
        webampRef.current.dispose();
        webampRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-testid="webamp-overlay"
    >
      <div 
        ref={containerRef} 
        className="relative"
        data-testid="webamp-container"
      />
      
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 px-4 py-2 rounded border border-[var(--terminal-text)] text-[var(--terminal-text)] hover:bg-[var(--terminal-text)] hover:text-[var(--terminal-bg)] transition-colors"
        data-testid="button-close-webamp"
      >
        ESC
      </button>
      
      {/* Instructions */}
      <div 
        className="fixed bottom-4 left-4 text-[var(--terminal-subtle)] text-sm font-mono"
        data-testid="text-webamp-instructions"
      >
        <div>Press ESC or close Webamp to return to terminal</div>
        <div>Visualizer Hotkeys: SPACE=Next preset, H=Hard cut, R=Toggle cycle</div>
      </div>
    </div>
  );
}
